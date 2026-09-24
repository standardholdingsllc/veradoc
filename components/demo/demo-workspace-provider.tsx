"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DEMO_POLL_INTERVAL_MS } from "@/lib/demo/constants";
import type {
  DemoSignerAction,
  DemoSnapshot,
  DemoWorkspacePayload,
} from "@/lib/demo/types";
import { useVeraDocStore } from "@/lib/store";

interface DemoWorkspaceContextValue {
  payload: DemoWorkspacePayload | null;
  error: string | null;
  refresh: () => Promise<void>;
  saveNow: () => Promise<DemoWorkspacePayload>;
  reset: () => Promise<void>;
  mutateSigner: (token: string, action: DemoSignerAction) => Promise<DemoWorkspacePayload>;
  sendSigningEmails: (packetId: string) => Promise<{ sent: string[]; duplicate: string[] }>;
}

const DemoWorkspaceContext = createContext<DemoWorkspaceContextValue | null>(null);

function snapshotFromStore(): DemoSnapshot {
  const state = useVeraDocStore.getState();
  return {
    users: structuredClone(state.users),
    packets: structuredClone(state.packets),
    registry: structuredClone(state.registry),
    currentRole: state.currentRole,
  };
}

function mergeSnapshots(local: DemoSnapshot, remote: DemoSnapshot): DemoSnapshot {
  const packetMap = new Map(remote.packets.map((packet) => [packet.id, packet]));
  for (const packet of local.packets) {
    const saved = packetMap.get(packet.id);
    if (!saved || Date.parse(packet.updatedAt) >= Date.parse(saved.updatedAt)) {
      packetMap.set(packet.id, packet);
    }
  }
  const registryMap = new Map(remote.registry.map((entry) => [entry.id, entry]));
  for (const entry of local.registry) registryMap.set(entry.id, entry);
  return {
    users: remote.users,
    packets: [...packetMap.values()],
    registry: [...registryMap.values()],
    currentRole: local.currentRole,
  };
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `DEMO_HTTP_${response.status}`);
  return body as T;
}

function isFatalDemoError(code: string): boolean {
  return [
    "DEMO_HTTP_404",
    "DEMO_HTTP_503",
    "DEMO_WORKSPACE_EXPIRED",
    "DEMO_CONTROL_UNAVAILABLE",
    "DEMO_BACKEND_NOT_CONFIGURED",
    "DEMO_ISOLATED_DEPLOYMENT_REQUIRED",
  ].includes(code);
}

export function DemoWorkspaceProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [payload, setPayload] = useState<DemoWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const payloadRef = useRef<DemoWorkspacePayload | null>(null);
  const applyingRemote = useRef(false);
  const dirty = useRef(false);
  const localMutationVersion = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef(Promise.resolve());
  const loadInFlight = useRef<Promise<void> | null>(null);

  const applyPayload = useCallback((next: DemoWorkspacePayload) => {
    applyingRemote.current = true;
    payloadRef.current = next;
    setPayload(next);
    useVeraDocStore.getState().replaceSnapshot(next.snapshot);
    queueMicrotask(() => {
      applyingRemote.current = false;
    });
  }, []);

  const signerToken = useMemo(() => {
    const match = pathname.match(/^\/(?:demo\/)?firma\/([^/]+)/);
    return match?.[1];
  }, [pathname]);
  const accessMode = signerToken
    ? `signer:${signerToken}`
    : /^\/(?:demo\/)?notario(?:\/|$)/.test(pathname)
      ? "notary"
      : "workspace";

  const performLoad = useCallback(async () => {
    try {
      let next: DemoWorkspacePayload;
      if (signerToken) {
        next = await jsonOrError<DemoWorkspacePayload>(
          await fetch(`/api/demo/signers/${encodeURIComponent(signerToken)}`, { cache: "no-store" }),
        );
      } else {
        const currentUrl = new URL(window.location.href);
        const fragment = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
        const accessToken = currentUrl.searchParams.get("demo_access") ?? fragment.get("demo_access");
        if (accessToken) {
          next = await jsonOrError<DemoWorkspacePayload>(
            await fetch("/api/demo/access/notary", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: accessToken }),
            }),
          );
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("demo_access");
          cleanUrl.hash = "";
          window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
        } else {
          const existing = await fetch("/api/demo/workspace", { cache: "no-store" });
          if ((existing.status === 401 || existing.status === 410) && accessMode === "workspace") {
            next = await jsonOrError<DemoWorkspacePayload>(
              await fetch("/api/demo/workspaces", { method: "POST" }),
            );
          } else {
            next = await jsonOrError<DemoWorkspacePayload>(existing);
          }
        }
      }
      applyPayload(next);
      setError(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "DEMO_LOAD_FAILED";
      setError(message);
      if (isFatalDemoError(message)) {
        payloadRef.current = null;
        setPayload(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accessMode, applyPayload, signerToken]);

  const load = useCallback((): Promise<void> => {
    if (loadInFlight.current) return loadInFlight.current;
    const pending = performLoad().finally(() => {
      if (loadInFlight.current === pending) loadInFlight.current = null;
    });
    loadInFlight.current = pending;
    return pending;
  }, [performLoad]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const persist = useCallback(async (): Promise<DemoWorkspacePayload> => {
    let snapshot = snapshotFromStore();
    const mutationVersionAtStart = localMutationVersion.current;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = payloadRef.current;
      if (!current || current.accessRole === "signer") throw new Error("DEMO_WRITE_NOT_ALLOWED");
      const response = await fetch("/api/demo/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: current.version, snapshot }),
      });
      if (response.status === 409) {
        const remote = await jsonOrError<DemoWorkspacePayload>(
          await fetch("/api/demo/workspace", { cache: "no-store" }),
        );
        payloadRef.current = remote;
        snapshot = mergeSnapshots(snapshotFromStore(), remote.snapshot);
        continue;
      }
      const next = await jsonOrError<DemoWorkspacePayload>(response);
      payloadRef.current = next;
      setPayload(next);
      if (localMutationVersion.current === mutationVersionAtStart) {
        dirty.current = false;
        applyPayload(next);
      }
      return next;
    }
    throw new Error("DEMO_VERSION_CONFLICT");
  }, [applyPayload]);

  useEffect(() => {
    if (!payload || payload.accessRole === "signer") return;
    return useVeraDocStore.subscribe((state, previous) => {
      if (applyingRemote.current) return;
      if (
        state.users === previous.users &&
        state.packets === previous.packets &&
        state.registry === previous.registry &&
        state.currentRole === previous.currentRole
      ) return;
      localMutationVersion.current += 1;
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        saveChain.current = saveChain.current
          .then(() => persist())
          .then(() => undefined)
          .catch((saveError) => setError(saveError instanceof Error ? saveError.message : "DEMO_SAVE_FAILED"));
      }, 250);
    });
  }, [payload, persist]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !dirty.current && !saveTimer.current) void load();
    }, DEMO_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await saveChain.current;
    return persist();
  }, [persist]);

  const reset = useCallback(async () => {
    const response = await fetch("/api/demo/workspace", { method: "DELETE" });
    if (!response.ok) throw new Error("DEMO_RESET_FAILED");
    const next = await jsonOrError<DemoWorkspacePayload>(
      await fetch("/api/demo/workspaces", { method: "POST" }),
    );
    applyPayload(next);
  }, [applyPayload]);

  const mutateSigner = useCallback(async (token: string, action: DemoSignerAction) => {
    const next = await jsonOrError<DemoWorkspacePayload>(
      await fetch(`/api/demo/signers/${encodeURIComponent(token)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      }),
    );
    applyPayload(next);
    return next;
  }, [applyPayload]);

  const sendSigningEmails = useCallback(async (packetId: string) => {
    await saveNow();
    return jsonOrError<{ sent: string[]; duplicate: string[] }>(
      await fetch("/api/demo/emails/signing-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packetId, idempotencyKey: crypto.randomUUID() }),
      }),
    );
  }, [saveNow]);

  const value = useMemo<DemoWorkspaceContextValue>(() => ({
    payload,
    error,
    refresh: load,
    saveNow,
    reset,
    mutateSigner,
    sendSigningEmails,
  }), [error, load, mutateSigner, payload, reset, saveNow, sendSigningEmails]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Preparando espacio demo compartido…
      </div>
    );
  }
  if (error && (!payload || isFatalDemoError(error))) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold text-primary">Demo no disponible</h1>
        <p className="text-sm text-muted">El enlace no existe, venció o el acceso fue desactivado.</p>
      </div>
    );
  }
  return <DemoWorkspaceContext.Provider value={value}>{children}</DemoWorkspaceContext.Provider>;
}

export function useDemoWorkspace(): DemoWorkspaceContextValue {
  const context = useContext(DemoWorkspaceContext);
  if (!context) throw new Error("useDemoWorkspace must be used inside DemoWorkspaceProvider");
  return context;
}
