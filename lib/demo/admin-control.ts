import "server-only";

import { demoConfig } from "./config";
import { getDemoControlState, setDemoControlState } from "./repository";
import type { DemoControlState } from "./types";

function controlUrl(): string {
  if (!demoConfig.controlOrigin) throw new Error("DEMO_CONTROL_ORIGIN_NOT_CONFIGURED");
  return new URL("/api/demo/control", demoConfig.controlOrigin).toString();
}
function canUseLocalControl(): boolean {
  return process.env.NODE_ENV !== "production" && (!demoConfig.controlOrigin || !demoConfig.controlSecret);
}

export async function readAdminDemoControl(): Promise<DemoControlState> {
  if (canUseLocalControl()) return getDemoControlState();
  if (!demoConfig.controlSecret) throw new Error("DEMO_CONTROL_SECRET_NOT_CONFIGURED");
  const response = await fetch(controlUrl(), {
    cache: "no-store",
    headers: { Authorization: `Bearer ${demoConfig.controlSecret}` },
  });
  if (!response.ok) throw new Error("DEMO_CONTROL_UNAVAILABLE");
  return response.json() as Promise<DemoControlState>;
}

export async function writeAdminDemoControl(
  enabled: boolean,
  actorId: string,
): Promise<DemoControlState> {
  if (canUseLocalControl()) return setDemoControlState(enabled, actorId);
  if (!demoConfig.controlSecret) throw new Error("DEMO_CONTROL_SECRET_NOT_CONFIGURED");
  const response = await fetch(controlUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${demoConfig.controlSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled, actorId }),
  });
  if (!response.ok) throw new Error("DEMO_CONTROL_UPDATE_FAILED");
  return response.json() as Promise<DemoControlState>;
}
