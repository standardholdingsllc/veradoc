import "server-only";

import { MOCK_PACKETS, MOCK_REGISTRY, MOCK_USERS } from "@/lib/store/initial-data";
import type { LeasePacket } from "@/lib/domain/types";
import { DEMO_EMAIL_ALLOWLIST, DEMO_WORKSPACE_TTL_HOURS } from "./constants";
import {
  buildDemoAbsoluteUrl,
  hasPersistentDemoBackend,
} from "./config";
import {
  createDemoToken,
  decryptDemoToken,
  encryptDemoToken,
  hashDemoToken,
} from "./crypto";
import type {
  DemoAccessRole,
  DemoControlState,
  DemoSnapshot,
  DemoWorkspaceLinks,
  DemoWorkspacePayload,
} from "./types";
import { parseDemoSnapshot } from "./validation";
import type { DemoSignerAction } from "./types";
import { applyDemoSignerAction } from "./signer-mutations";
import {
  redisClaimEmail,
  redisCreateWorkspace,
  redisDeleteCapabilities,
  redisDeleteWorkspace,
  redisFinishEmail,
  redisGetCapabilities,
  redisGetCapability,
  redisGetControl,
  redisGetWorkspaceByAccessHash,
  redisGetWorkspaceById,
  redisSetControl,
  redisUpdateWorkspace,
  redisUpsertCapabilities,
  type SignerCapabilityRow,
  type WorkspaceRow,
} from "./redis-backend";

interface MemoryBackend {
  workspaces: Map<string, WorkspaceRow>;
  capabilities: Map<string, SignerCapabilityRow>;
  emails: Map<string, { workspaceId: string; recipient: string; status: string; createdAt: string; providerId?: string }>;
  control: DemoControlState;
}

const memoryKey = Symbol.for("veradoc.demo.backend");

function memoryBackend(): MemoryBackend {
  const root = globalThis as typeof globalThis & { [memoryKey]?: MemoryBackend };
  root[memoryKey] ??= {
    workspaces: new Map(),
    capabilities: new Map(),
    emails: new Map(),
    control: { enabled: true, updatedAt: new Date(0).toISOString(), updatedBy: null },
  };
  return root[memoryKey];
}

function shouldUseMemoryBackend(): boolean {
  return !hasPersistentDemoBackend() && process.env.NODE_ENV !== "production";
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function expiresAt(): string {
  return new Date(Date.now() + DEMO_WORKSPACE_TTL_HOURS * 60 * 60 * 1_000).toISOString();
}

function isExpired(value: string): boolean {
  return Date.parse(value) <= Date.now();
}

function seedSnapshot(): DemoSnapshot {
  const snapshot: DemoSnapshot = {
    users: clone(MOCK_USERS),
    packets: clone(MOCK_PACKETS),
    registry: clone(MOCK_REGISTRY),
    currentRole: "realtor",
  };
  let signerIndex = 0;
  for (const packet of snapshot.packets) {
    for (const signer of packet.signers) {
      signer.email = DEMO_EMAIL_ALLOWLIST[signerIndex % DEMO_EMAIL_ALLOWLIST.length];
      signer.whatsapp = `+5100000000${signerIndex % 10}`;
      signerIndex += 1;
    }
  }
  return snapshot;
}

function withoutRawTokens(snapshot: DemoSnapshot): DemoSnapshot {
  const safe = clone(snapshot);
  for (const packet of safe.packets) {
    for (const signer of packet.signers) signer.secureLinkToken = "";
  }
  return safe;
}

function restrictNotarySnapshot(current: DemoSnapshot, proposed: DemoSnapshot): DemoSnapshot {
  const result = clone(current);
  result.currentRole = "notary";
  result.registry = clone(proposed.registry);
  result.packets = current.packets.map((packet) => {
    const next = proposed.packets.find((entry) => entry.id === packet.id);
    if (!next) return packet;
    return {
      ...packet,
      status: next.status,
      updatedAt: next.updatedAt,
      certifiedDocument: next.certifiedDocument,
      documentHashes: clone(next.documentHashes),
      evidenceReport: next.evidenceReport ? clone(next.evidenceReport) : undefined,
      notaryReview: next.notaryReview ? clone(next.notaryReview) : undefined,
      registryCheck: clone(next.registryCheck),
      auditEvents: clone(next.auditEvents),
    };
  });
  return result;
}

function signerKey(packetId: string, signerId: string): string {
  return `${packetId}:${signerId}`;
}

async function getCapabilities(workspaceId: string): Promise<SignerCapabilityRow[]> {
  if (shouldUseMemoryBackend()) {
    return [...memoryBackend().capabilities.values()].filter((cap) => cap.workspace_id === workspaceId);
  }
  return redisGetCapabilities(workspaceId);
}

async function upsertCapabilities(rows: SignerCapabilityRow[]): Promise<void> {
  if (rows.length === 0) return;
  if (shouldUseMemoryBackend()) {
    for (const row of rows) memoryBackend().capabilities.set(row.token_hash, clone(row));
    return;
  }
  await redisUpsertCapabilities(rows);
}

async function deleteStaleCapabilities(workspaceId: string, activeKeys: Set<string>): Promise<void> {
  const existing = await getCapabilities(workspaceId);
  const stale = existing.filter((row) => !activeKeys.has(signerKey(row.packet_id, row.signer_id)));
  if (stale.length === 0) return;
  if (shouldUseMemoryBackend()) {
    for (const row of stale) memoryBackend().capabilities.delete(row.token_hash);
    return;
  }
  await redisDeleteCapabilities(stale);
}

async function ensureSignerCapabilities(
  workspaceId: string,
  snapshot: DemoSnapshot,
  expiration: string,
): Promise<Map<string, string>> {
  const existing = await getCapabilities(workspaceId);
  const bySigner = new Map(existing.map((row) => [signerKey(row.packet_id, row.signer_id), row]));
  const tokens = new Map<string, string>();
  const rows: SignerCapabilityRow[] = [];
  const activeKeys = new Set<string>();

  for (const packet of snapshot.packets) {
    for (const signer of packet.signers) {
      const key = signerKey(packet.id, signer.id);
      activeKeys.add(key);
      const saved = bySigner.get(key);
      const rawToken = saved ? decryptDemoToken(saved.token_ciphertext) : createDemoToken("signer");
      tokens.set(key, rawToken);
      rows.push({
        token_hash: hashDemoToken(rawToken),
        token_ciphertext: encryptDemoToken(rawToken),
        workspace_id: workspaceId,
        packet_id: packet.id,
        signer_id: signer.id,
        expires_at: expiration,
        created_at: saved?.created_at ?? new Date().toISOString(),
      });
    }
  }

  await upsertCapabilities(rows);
  await deleteStaleCapabilities(workspaceId, activeKeys);
  return tokens;
}

function injectTokens(snapshot: DemoSnapshot, tokens: Map<string, string>, role: DemoAccessRole): DemoSnapshot {
  const hydrated = clone(snapshot);
  for (const packet of hydrated.packets) {
    for (const signer of packet.signers) {
      signer.secureLinkToken = role === "notary" ? "" : (tokens.get(signerKey(packet.id, signer.id)) ?? "");
    }
  }
  return hydrated;
}

function linksFor(row: WorkspaceRow, tokens: Map<string, string>): DemoWorkspaceLinks {
  const signers: Record<string, string> = {};
  for (const [key, token] of tokens) {
    signers[key] = buildDemoAbsoluteUrl(`/firma/${token}`);
  }
  const notaryToken = decryptDemoToken(row.notary_token_ciphertext);
  const notaryUrl = new URL(buildDemoAbsoluteUrl("/notario"));
  notaryUrl.hash = new URLSearchParams({ demo_access: notaryToken }).toString();
  return { notary: notaryUrl.toString(), signers };
}

async function payloadFor(row: WorkspaceRow, role: DemoAccessRole): Promise<DemoWorkspacePayload> {
  if (isExpired(row.expires_at)) throw new Error("DEMO_WORKSPACE_EXPIRED");
  const caps = await getCapabilities(row.id);
  const tokens = new Map(caps.map((cap) => [signerKey(cap.packet_id, cap.signer_id), decryptDemoToken(cap.token_ciphertext)]));
  return {
    workspaceId: row.id,
    version: Number(row.version),
    expiresAt: row.expires_at,
    accessRole: role,
    snapshot: injectTokens(row.state, tokens, role),
    links: role === "presenter" ? linksFor(row, tokens) : { notary: "", signers: {} },
  };
}

async function insertWorkspace(row: WorkspaceRow): Promise<void> {
  if (shouldUseMemoryBackend()) {
    memoryBackend().workspaces.set(row.id, clone(row));
    return;
  }
  await redisCreateWorkspace(row);
}

export async function createDemoWorkspace(): Promise<{ payload: DemoWorkspacePayload; presenterToken: string }> {
  await purgeExpiredDemoWorkspaces();
  const presenterToken = createDemoToken("presenter");
  const notaryToken = createDemoToken("notary");
  const workspaceId = crypto.randomUUID();
  const expiration = expiresAt();
  const snapshot = seedSnapshot();
  const now = new Date().toISOString();
  const row: WorkspaceRow = {
    id: workspaceId,
    presenter_token_hash: hashDemoToken(presenterToken),
    notary_token_hash: hashDemoToken(notaryToken),
    notary_token_ciphertext: encryptDemoToken(notaryToken),
    state: withoutRawTokens(snapshot),
    version: 1,
    expires_at: expiration,
    created_at: now,
    updated_at: now,
  };
  await insertWorkspace(row);
  await ensureSignerCapabilities(workspaceId, snapshot, expiration);
  return { payload: await payloadFor(row, "presenter"), presenterToken };
}

async function rowByColumn(column: string, value: string): Promise<WorkspaceRow | undefined> {
  if (shouldUseMemoryBackend()) {
    return [...memoryBackend().workspaces.values()].find((row) => (row as unknown as Record<string, unknown>)[column] === value);
  }
  if (column === "id") return redisGetWorkspaceById(value);
  if (column === "presenter_token_hash") return redisGetWorkspaceByAccessHash("presenter", value);
  if (column === "notary_token_hash") return redisGetWorkspaceByAccessHash("notary", value);
  throw new Error("DEMO_WORKSPACE_READ_FAILED");
}

async function signerCapabilityByToken(token: string): Promise<SignerCapabilityRow | undefined> {
  const tokenHash = hashDemoToken(token);
  if (shouldUseMemoryBackend()) return memoryBackend().capabilities.get(tokenHash);
  return redisGetCapability(tokenHash);
}

export async function getDemoWorkspaceByAccessToken(
  token: string,
  role: "presenter" | "notary",
): Promise<DemoWorkspacePayload> {
  const column = role === "presenter" ? "presenter_token_hash" : "notary_token_hash";
  const row = await rowByColumn(column, hashDemoToken(token));
  if (!row) throw new Error("DEMO_WORKSPACE_NOT_FOUND");
  return payloadFor(row, role);
}

export async function getDemoSignerWorkspace(token: string): Promise<DemoWorkspacePayload> {
  const cap = await signerCapabilityByToken(token);
  if (!cap || isExpired(cap.expires_at)) throw new Error("DEMO_SIGNER_LINK_INVALID");
  const row = shouldUseMemoryBackend()
    ? memoryBackend().workspaces.get(cap.workspace_id)
    : await rowByColumn("id", cap.workspace_id);
  if (!row) throw new Error("DEMO_WORKSPACE_NOT_FOUND");
  const payload = await payloadFor(row, "signer");
  const packet = payload.snapshot.packets.find((entry) => entry.id === cap!.packet_id);
  if (!packet) throw new Error("DEMO_SIGNER_LINK_INVALID");
  payload.snapshot.packets = [packet];
  payload.snapshot.registry = payload.snapshot.registry.filter((entry) => entry.packetId === packet.id);
  payload.snapshot.users = payload.snapshot.users.filter((user) => user.id === packet.createdByRealtorId);
  for (const signer of packet.signers) {
    signer.secureLinkToken = signer.id === cap.signer_id ? token : "";
  }
  payload.links = { notary: "", signers: {} };
  return payload;
}

export async function mutateDemoSignerWorkspace(
  token: string,
  action: DemoSignerAction,
): Promise<DemoWorkspacePayload> {
  const cap = await signerCapabilityByToken(token);
  if (!cap || isExpired(cap.expires_at)) throw new Error("DEMO_SIGNER_LINK_INVALID");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = shouldUseMemoryBackend()
      ? memoryBackend().workspaces.get(cap.workspace_id)
      : await rowByColumn("id", cap.workspace_id);
    if (!row || isExpired(row.expires_at)) throw new Error("DEMO_WORKSPACE_EXPIRED");
    const state = withoutRawTokens(
      applyDemoSignerAction(row.state, cap.packet_id, cap.signer_id, action),
    );
    const now = new Date().toISOString();
    let updated: WorkspaceRow | undefined;
    if (shouldUseMemoryBackend()) {
      const latest = memoryBackend().workspaces.get(row.id);
      if (!latest || latest.version !== row.version) continue;
      updated = { ...latest, state, version: latest.version + 1, updated_at: now };
      memoryBackend().workspaces.set(row.id, clone(updated));
    } else {
      const candidate = { ...row, state, version: row.version + 1, updated_at: now };
      const result = await redisUpdateWorkspace(candidate, row.version);
      if (result === "missing") throw new Error("DEMO_WORKSPACE_EXPIRED");
      if (result === "conflict") continue;
      updated = candidate;
    }
    const payload = await payloadFor(updated, "signer");
    const packet = payload.snapshot.packets.find((entry) => entry.id === cap.packet_id);
    if (!packet) throw new Error("DEMO_SIGNER_LINK_INVALID");
    payload.snapshot.packets = [packet];
    payload.snapshot.registry = payload.snapshot.registry.filter((entry) => entry.packetId === packet.id);
    payload.snapshot.users = payload.snapshot.users.filter((user) => user.id === packet.createdByRealtorId);
    for (const signer of packet.signers) signer.secureLinkToken = signer.id === cap.signer_id ? token : "";
    payload.links = { notary: "", signers: {} };
    return payload;
  }
  throw new Error("DEMO_VERSION_CONFLICT");
}

export async function saveDemoWorkspace(
  accessToken: string,
  role: "presenter" | "notary",
  expectedVersion: number,
  input: unknown,
): Promise<DemoWorkspacePayload> {
  const current = await getDemoWorkspaceByAccessToken(accessToken, role);
  if (current.version !== expectedVersion) throw new Error("DEMO_VERSION_CONFLICT");
  const parsedInput = parseDemoSnapshot(input);
  const parsed = role === "notary"
    ? restrictNotarySnapshot(current.snapshot, parsedInput)
    : parsedInput;
  const expiration = current.expiresAt;
  const state = withoutRawTokens(parsed);
  const now = new Date().toISOString();
  let updated: WorkspaceRow | undefined;

  if (shouldUseMemoryBackend()) {
    const row = memoryBackend().workspaces.get(current.workspaceId);
    if (!row || row.version !== expectedVersion) throw new Error("DEMO_VERSION_CONFLICT");
    updated = { ...row, state, version: row.version + 1, updated_at: now };
    memoryBackend().workspaces.set(row.id, clone(updated));
  } else {
    const row = await redisGetWorkspaceById(current.workspaceId);
    if (!row) throw new Error("DEMO_WORKSPACE_EXPIRED");
    const candidate = { ...row, state, version: expectedVersion + 1, updated_at: now };
    const result = await redisUpdateWorkspace(candidate, expectedVersion);
    if (result === "missing") throw new Error("DEMO_WORKSPACE_EXPIRED");
    if (result === "conflict") throw new Error("DEMO_VERSION_CONFLICT");
    updated = candidate;
  }

  const tokens = await ensureSignerCapabilities(current.workspaceId, parsed, expiration);
  const result = await payloadFor(updated, role);
  result.snapshot = injectTokens(result.snapshot, tokens, role);
  return result;
}

export async function deleteDemoWorkspace(presenterToken: string): Promise<void> {
  const payload = await getDemoWorkspaceByAccessToken(presenterToken, "presenter");
  if (shouldUseMemoryBackend()) {
    memoryBackend().workspaces.delete(payload.workspaceId);
    for (const [hash, cap] of memoryBackend().capabilities) {
      if (cap.workspace_id === payload.workspaceId) memoryBackend().capabilities.delete(hash);
    }
    return;
  }
  await redisDeleteWorkspace(payload.workspaceId);
}

export async function purgeExpiredDemoWorkspaces(): Promise<void> {
  if (shouldUseMemoryBackend()) {
    const expiredWorkspaceIds = new Set<string>();
    for (const [id, row] of memoryBackend().workspaces) {
      if (isExpired(row.expires_at)) {
        memoryBackend().workspaces.delete(id);
        expiredWorkspaceIds.add(id);
      }
    }
    for (const [hash, capability] of memoryBackend().capabilities) {
      if (expiredWorkspaceIds.has(capability.workspace_id)) {
        memoryBackend().capabilities.delete(hash);
      }
    }
    for (const [key, delivery] of memoryBackend().emails) {
      if (expiredWorkspaceIds.has(delivery.workspaceId)) {
        memoryBackend().emails.delete(key);
      }
    }
    return;
  }
  // Redis TTL removes expired workspaces and related capability keys.
}

export async function getDemoControlState(): Promise<DemoControlState> {
  if (shouldUseMemoryBackend()) return clone(memoryBackend().control);
  return redisGetControl();
}

export async function setDemoControlState(enabled: boolean, actorId: string): Promise<DemoControlState> {
  const updatedAt = new Date().toISOString();
  if (shouldUseMemoryBackend()) {
    memoryBackend().control = { enabled, updatedAt, updatedBy: actorId };
    return clone(memoryBackend().control);
  }
  const state = { enabled, updatedAt, updatedBy: actorId };
  await redisSetControl(state);
  return state;
}

export async function getWorkspacePacketForPresenter(
  presenterToken: string,
  packetId: string,
): Promise<{ payload: DemoWorkspacePayload; packet: LeasePacket }> {
  const payload = await getDemoWorkspaceByAccessToken(presenterToken, "presenter");
  const packet = payload.snapshot.packets.find((entry) => entry.id === packetId);
  if (!packet) throw new Error("DEMO_PACKET_NOT_FOUND");
  return { payload, packet };
}

export async function claimDemoEmailDelivery(params: {
  workspaceId: string;
  recipient: string;
  idempotencyKey: string;
}): Promise<"claimed" | "duplicate" | "rate_limited"> {
  if (shouldUseMemoryBackend()) {
    const backend = memoryBackend();
    if (backend.emails.has(`${params.workspaceId}:${params.idempotencyKey}`)) return "duplicate";
    const recent = [...backend.emails.values()].filter(
      (row) =>
        row.workspaceId === params.workspaceId &&
        row.recipient === params.recipient &&
        Date.parse(row.createdAt) >= Date.now() - 15 * 60 * 1_000,
    );
    if (recent.length >= 5) return "rate_limited";
    backend.emails.set(`${params.workspaceId}:${params.idempotencyKey}`, {
      workspaceId: params.workspaceId,
      recipient: params.recipient,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return "claimed";
  }
  return redisClaimEmail(params);
}

export async function finishDemoEmailDelivery(params: {
  workspaceId: string;
  idempotencyKey: string;
  status: "sent" | "failed";
  providerId?: string;
  errorCode?: string;
}): Promise<void> {
  if (shouldUseMemoryBackend()) {
    const key = `${params.workspaceId}:${params.idempotencyKey}`;
    const current = memoryBackend().emails.get(key);
    if (current) memoryBackend().emails.set(key, { ...current, status: params.status, providerId: params.providerId });
    return;
  }
  await redisFinishEmail(params);
}
