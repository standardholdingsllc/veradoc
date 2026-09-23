import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/demo/config", () => ({
  demoConfig: {},
  hasPersistentDemoBackend: () => false,
  assertPersistentDemoBackendConfigured: () => undefined,
  buildDemoAbsoluteUrl: (path: string) => `https://demo.veradoc.pe${path}`,
}));

import {
  createDemoWorkspace,
  deleteDemoWorkspace,
  getDemoSignerWorkspace,
  getDemoWorkspaceByAccessToken,
  mutateDemoSignerWorkspace,
  saveDemoWorkspace,
  setDemoControlState,
  getDemoControlState,
} from "@/lib/demo/repository";
import { POST as createWorkspaceRoute } from "@/app/api/demo/workspaces/route";
import { DELETE as deleteWorkspaceRoute } from "@/app/api/demo/workspace/route";

function tokenFromUrl(value: string): string {
  return new URL(value).pathname.split("/").at(-1)!;
}

describe("shared demo workspace", () => {
  it("shares signer progress across isolated capabilities and revokes it on reset", async () => {
    const created = await createDemoWorkspace();
    const signer = created.payload.snapshot.packets
      .flatMap((packet) => packet.signers.map((entry) => ({ packet, signer: entry })))
      .find(({ signer: entry }) => entry.status === "identity_uploaded");
    expect(signer).toBeDefined();
    const link = created.payload.links.signers[`${signer!.packet.id}:${signer!.signer.id}`];
    const token = tokenFromUrl(link);

    const browserB = await getDemoSignerWorkspace(token);
    expect(browserB.workspaceId).toBe(created.payload.workspaceId);
    expect(browserB.accessRole).toBe("signer");
    expect(browserB.snapshot.packets).toHaveLength(1);
    expect(browserB.snapshot.packets[0].signers.find((entry) => entry.id === signer!.signer.id)?.secureLinkToken)
      .toBe(token);
    expect(browserB.snapshot.packets[0].signers.filter((entry) => entry.secureLinkToken)).toHaveLength(1);

    await mutateDemoSignerWorkspace(token, { type: "complete_liveness" });
    const browserA = await getDemoWorkspaceByAccessToken(created.presenterToken, "presenter");
    expect(
      browserA.snapshot.packets
        .find((packet) => packet.id === signer!.packet.id)
        ?.signers.find((entry) => entry.id === signer!.signer.id)?.status,
    ).toBe("identity_verified_demo");

    await deleteDemoWorkspace(created.presenterToken);
    await expect(getDemoSignerWorkspace(token)).rejects.toThrow("DEMO_SIGNER_LINK_INVALID");
  });

  it("restricts notary writes to notarial fields", async () => {
    const created = await createDemoWorkspace();
    const notaryUrl = new URL(created.payload.links.notary);
    const notaryToken = new URLSearchParams(notaryUrl.hash.slice(1)).get("demo_access")!;
    const notary = await getDemoWorkspaceByAccessToken(notaryToken, "notary");
    const originalAddress = notary.snapshot.packets[0].property.address;
    notary.snapshot.packets[0].property.address = "malicious overwrite";
    notary.snapshot.packets[0].notaryReview = {
      status: "pending",
      reviewChecklist: [],
      observations: "Revisión sintética",
    };
    notary.snapshot.packets[0].demoNotaryPriority = "urgent";
    notary.snapshot.packets[0].demoAuthorityCheck = {
      titleNumber: "DEMO-123", result: "verified", ownerNames: "Persona de ejemplo", notes: "Consulta simulada", checkedAt: new Date().toISOString(),
    };
    notary.snapshot.packets[0].demoSealWorkflow = { signedDocumentPreparedAt: new Date().toISOString() };
    notary.snapshot.packets[0].updatedAt = new Date().toISOString();

    await saveDemoWorkspace(notaryToken, "notary", notary.version, notary.snapshot);
    const presenter = await getDemoWorkspaceByAccessToken(created.presenterToken, "presenter");
    expect(presenter.snapshot.packets[0].property.address).toBe(originalAddress);
    expect(presenter.snapshot.packets[0].notaryReview?.observations).toBe("Revisión sintética");
    expect(presenter.snapshot.packets[0].demoNotaryPriority).toBe("urgent");
    expect(presenter.snapshot.packets[0].demoAuthorityCheck?.titleNumber).toBe("DEMO-123");
    expect(presenter.snapshot.packets[0].demoSealWorkflow?.signedDocumentPreparedAt).toBeTruthy();
    await deleteDemoWorkspace(created.presenterToken);
  });

  it("expires workspace and signer capabilities after the demo TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T12:00:00.000Z"));
    try {
      const created = await createDemoWorkspace();
      const signerLink = Object.values(created.payload.links.signers)[0];
      const signerToken = tokenFromUrl(signerLink);

      vi.advanceTimersByTime(8 * 60 * 60 * 1_000 + 1);

      await expect(
        getDemoWorkspaceByAccessToken(created.presenterToken, "presenter"),
      ).rejects.toThrow("DEMO_WORKSPACE_EXPIRED");
      await expect(getDemoSignerWorkspace(signerToken)).rejects.toThrow(
        "DEMO_SIGNER_LINK_INVALID",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stores and changes the global demo kill switch", async () => {
    const actorId = crypto.randomUUID();
    await setDemoControlState(false, actorId);
    expect(await getDemoControlState()).toMatchObject({ enabled: false, updatedBy: actorId });
    const disabledResponse = await createWorkspaceRoute(
      new NextRequest("https://demo.veradoc.pe/api/demo/workspaces", {
        method: "POST",
        headers: { origin: "https://demo.veradoc.pe" },
      }),
    );
    expect(disabledResponse.status).toBe(404);
    const disabledDeleteResponse = await deleteWorkspaceRoute(
      new NextRequest("https://demo.veradoc.pe/api/demo/workspace", {
        method: "DELETE",
        headers: { origin: "https://demo.veradoc.pe" },
      }),
    );
    expect(disabledDeleteResponse.status).toBe(404);
    await setDemoControlState(true, actorId);
    expect((await getDemoControlState()).enabled).toBe(true);
  });
});
