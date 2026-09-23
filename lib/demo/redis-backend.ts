import "server-only";

import { createHash } from "node:crypto";
import type { DemoControlState, DemoSnapshot } from "./types";
import { assertPersistentDemoBackendConfigured, demoConfig } from "./config";

export interface WorkspaceRow {
  id: string;
  presenter_token_hash: string;
  notary_token_hash: string;
  notary_token_ciphertext: string;
  state: DemoSnapshot;
  version: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface SignerCapabilityRow {
  token_hash: string;
  token_ciphertext: string;
  workspace_id: string;
  packet_id: string;
  signer_id: string;
  expires_at: string;
  created_at: string;
}

const PREFIX = "veradoc:demo:v1:";
const CONTROL_KEY = `${PREFIX}control`;
const CONTROL_AUDIT_KEY = `${PREFIX}control:audit`;
const EMAIL_WINDOW_MS = 15 * 60 * 1_000;

const workspaceKey = (id: string) => `${PREFIX}workspace:${id}`;
const workspaceKeysIndex = (id: string) => `${PREFIX}workspace:${id}:keys`;
const capabilityIndex = (id: string) => `${PREFIX}workspace:${id}:capabilities`;
const capabilityKey = (hash: string) => `${PREFIX}capability:${hash}`;
const accessKey = (role: "presenter" | "notary", hash: string) => `${PREFIX}access:${role}:${hash}`;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deliveryKey(workspaceId: string, idempotencyKey: string): string {
  return `${PREFIX}delivery:${workspaceId}:${digest(idempotencyKey)}`;
}

function rateKey(workspaceId: string, recipient: string): string {
  return `${PREFIX}email-rate:${workspaceId}:${digest(recipient.toLowerCase())}`;
}

function remainingMs(expiration: string): number {
  return Math.max(1, Date.parse(expiration) - Date.now());
}

async function command<T>(args: Array<string | number>): Promise<T> {
  assertPersistentDemoBackendConfigured();
  let response: Response;
  try {
    response = await fetch(demoConfig.backendUrl!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${demoConfig.backendSecretKey!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("DEMO_BACKEND_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("DEMO_BACKEND_UNAVAILABLE");
  const result = await response.json() as { result?: T; error?: string };
  if (result.error || !("result" in result)) throw new Error("DEMO_BACKEND_UNAVAILABLE");
  return result.result as T;
}

async function evaluate<T>(script: string, keys: string[], args: Array<string | number>): Promise<T> {
  return command<T>(["EVAL", script, keys.length, ...keys, ...args]);
}

async function getJson<T>(key: string): Promise<T | undefined> {
  const raw = await command<string | null>(["GET", key]);
  return raw === null ? undefined : JSON.parse(raw) as T;
}

const CREATE_WORKSPACE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
redis.call('SET', KEYS[3], ARGV[2], 'PX', ARGV[3])
redis.call('SADD', KEYS[4], KEYS[2], KEYS[3])
redis.call('PEXPIRE', KEYS[4], ARGV[3])
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
return 1
`;

export async function redisCreateWorkspace(row: WorkspaceRow): Promise<void> {
  const result = await evaluate<number>(CREATE_WORKSPACE, [
    workspaceKey(row.id),
    accessKey("presenter", row.presenter_token_hash),
    accessKey("notary", row.notary_token_hash),
    workspaceKeysIndex(row.id),
  ], [JSON.stringify(row), row.id, remainingMs(row.expires_at)]);
  if (result !== 1) throw new Error("DEMO_WORKSPACE_CREATE_FAILED");
}

export async function redisGetWorkspaceById(id: string): Promise<WorkspaceRow | undefined> {
  return getJson<WorkspaceRow>(workspaceKey(id));
}

export async function redisGetWorkspaceByAccessHash(
  role: "presenter" | "notary",
  hash: string,
): Promise<WorkspaceRow | undefined> {
  const id = await command<string | null>(["GET", accessKey(role, hash)]);
  if (!id) return undefined;
  const row = await redisGetWorkspaceById(id);
  if (!row || (role === "presenter" ? row.presenter_token_hash : row.notary_token_hash) !== hash) {
    return undefined;
  }
  return row;
}

export async function redisGetCapability(hash: string): Promise<SignerCapabilityRow | undefined> {
  return getJson<SignerCapabilityRow>(capabilityKey(hash));
}

export async function redisGetCapabilities(workspaceId: string): Promise<SignerCapabilityRow[]> {
  const hashes = await command<string[]>(["SMEMBERS", capabilityIndex(workspaceId)]);
  if (!hashes.length) return [];
  const values = await command<Array<string | null>>(["MGET", ...hashes.map(capabilityKey)]);
  return values.filter((value): value is string => value !== null)
    .map((value) => JSON.parse(value) as SignerCapabilityRow)
    .filter((row) => row.workspace_id === workspaceId);
}

const UPSERT_CAPABILITY = `
if redis.call('EXISTS', KEYS[1]) ~= 1 then return 0 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'PX', ttl)
redis.call('SADD', KEYS[3], ARGV[2])
redis.call('PEXPIRE', KEYS[3], ttl)
redis.call('SADD', KEYS[4], KEYS[2], KEYS[3])
redis.call('PEXPIRE', KEYS[4], ttl)
return 1
`;

export async function redisUpsertCapabilities(rows: SignerCapabilityRow[]): Promise<void> {
  for (const row of rows) {
    const result = await evaluate<number>(UPSERT_CAPABILITY, [
      workspaceKey(row.workspace_id),
      capabilityKey(row.token_hash),
      capabilityIndex(row.workspace_id),
      workspaceKeysIndex(row.workspace_id),
    ], [JSON.stringify(row), row.token_hash]);
    if (result !== 1) throw new Error("DEMO_CAPABILITY_WRITE_FAILED");
  }
}

export async function redisDeleteCapabilities(rows: SignerCapabilityRow[]): Promise<void> {
  for (const row of rows) {
    await command<number>(["DEL", capabilityKey(row.token_hash)]);
    await command<number>(["SREM", capabilityIndex(row.workspace_id), row.token_hash]);
    await command<number>(["SREM", workspaceKeysIndex(row.workspace_id), capabilityKey(row.token_hash)]);
  }
}

const UPDATE_WORKSPACE = `
local current = redis.call('GET', KEYS[1])
if not current then return -1 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return -1 end
if cjson.decode(current).version ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ttl)
return 1
`;

export async function redisUpdateWorkspace(
  row: WorkspaceRow,
  expectedVersion: number,
): Promise<"updated" | "conflict" | "missing"> {
  const result = await evaluate<number>(UPDATE_WORKSPACE, [workspaceKey(row.id)], [
    expectedVersion, JSON.stringify(row),
  ]);
  return result === 1 ? "updated" : result === 0 ? "conflict" : "missing";
}

export async function redisDeleteWorkspace(id: string): Promise<void> {
  const index = workspaceKeysIndex(id);
  const related = await command<string[]>(["SMEMBERS", index]);
  // Removing the workspace first makes every capability unusable immediately.
  await command<number>(["DEL", workspaceKey(id)]);
  for (let offset = 0; offset < related.length; offset += 100) {
    await command<number>(["DEL", ...related.slice(offset, offset + 100)]);
  }
  await command<number>(["DEL", index]);
}

export async function redisGetControl(): Promise<DemoControlState> {
  const state = await getJson<DemoControlState>(CONTROL_KEY);
  if (!state) throw new Error("DEMO_CONTROL_UNAVAILABLE");
  return state;
}

const UPDATE_CONTROL = `
if redis.call('EXISTS', KEYS[1]) ~= 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('LPUSH', KEYS[2], ARGV[1])
redis.call('LTRIM', KEYS[2], 0, 999)
return 1
`;

export async function redisSetControl(state: DemoControlState): Promise<void> {
  const result = await evaluate<number>(UPDATE_CONTROL, [CONTROL_KEY, CONTROL_AUDIT_KEY], [
    JSON.stringify(state),
  ]);
  if (result !== 1) throw new Error("DEMO_CONTROL_UNAVAILABLE");
}

const CLAIM_EMAIL = `
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 'missing' end
if redis.call('EXISTS', KEYS[2]) == 1 then return 'duplicate' end
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[3]) >= 5 then return 'rate_limited' end
redis.call('SET', KEYS[2], ARGV[3], 'PX', ttl)
redis.call('ZADD', KEYS[3], ARGV[2], ARGV[4])
redis.call('PEXPIRE', KEYS[3], math.min(ttl, 900000))
redis.call('SADD', KEYS[4], KEYS[2], KEYS[3])
redis.call('PEXPIRE', KEYS[4], ttl)
return 'claimed'
`;

export async function redisClaimEmail(params: {
  workspaceId: string;
  recipient: string;
  idempotencyKey: string;
}): Promise<"claimed" | "duplicate" | "rate_limited"> {
  const now = Date.now();
  const result = await evaluate<string>(CLAIM_EMAIL, [
    workspaceKey(params.workspaceId),
    deliveryKey(params.workspaceId, params.idempotencyKey),
    rateKey(params.workspaceId, params.recipient),
    workspaceKeysIndex(params.workspaceId),
  ], [
    now - EMAIL_WINDOW_MS,
    now,
    JSON.stringify({ status: "pending", createdAt: new Date(now).toISOString() }),
    digest(params.idempotencyKey),
  ]);
  if (result === "claimed" || result === "duplicate" || result === "rate_limited") return result;
  throw new Error("DEMO_WORKSPACE_EXPIRED");
}

const FINISH_EMAIL = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 0 end
local record = cjson.decode(current)
record.status = ARGV[1]
record.providerId = ARGV[2]
record.errorCode = ARGV[3]
record.updatedAt = ARGV[4]
redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
return 1
`;

export async function redisFinishEmail(params: {
  workspaceId: string;
  idempotencyKey: string;
  status: "sent" | "failed";
  providerId?: string;
  errorCode?: string;
}): Promise<void> {
  const result = await evaluate<number>(FINISH_EMAIL, [
    deliveryKey(params.workspaceId, params.idempotencyKey),
  ], [params.status, params.providerId ?? "", params.errorCode ?? "", new Date().toISOString()]);
  if (result !== 1) throw new Error("DEMO_EMAIL_FINALIZE_FAILED");
}
