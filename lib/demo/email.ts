import "server-only";

import { Resend } from "resend";
import { isAllowedDemoEmail } from "./constants";
import { demoConfig } from "./config";
import {
  claimDemoEmailDelivery,
  finishDemoEmailDelivery,
  getWorkspacePacketForPresenter,
} from "./repository";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function sendDemoSigningEmails(params: {
  presenterToken: string;
  packetId: string;
  idempotencyKey: string;
}): Promise<{ sent: string[]; duplicate: string[] }> {
  if (!demoConfig.emailApiKey || !demoConfig.emailFrom) {
    throw new Error("DEMO_EMAIL_NOT_CONFIGURED");
  }
  const { payload, packet } = await getWorkspacePacketForPresenter(
    params.presenterToken,
    params.packetId,
  );
  const resend = new Resend(demoConfig.emailApiKey);
  const sent: string[] = [];
  const duplicate: string[] = [];

  for (const signer of packet.signers) {
    const recipient = signer.email.trim().toLowerCase();
    if (!isAllowedDemoEmail(recipient)) throw new Error("DEMO_EMAIL_NOT_ALLOWED");
    const deliveryKey = `${params.idempotencyKey}:${signer.id}`;
    const claim = await claimDemoEmailDelivery({
      workspaceId: payload.workspaceId,
      recipient,
      idempotencyKey: deliveryKey,
    });
    if (claim === "duplicate") {
      duplicate.push(recipient);
      continue;
    }
    if (claim === "rate_limited") throw new Error("DEMO_EMAIL_RATE_LIMITED");
    const link = payload.links.signers[`${packet.id}:${signer.id}`];
    if (!link) throw new Error("DEMO_SIGNER_LINK_INVALID");

    try {
      const result = await resend.emails.send(
        {
          from: demoConfig.emailFrom,
          to: recipient,
          subject: `[DEMO] Firma de ${packet.packetCode} — VeraDoc`,
          html: `<p>Hola ${escapeHtml(signer.fullName)},</p><p>Este es un correo de demostración de VeraDoc con datos completamente sintéticos.</p><p><a href="${escapeHtml(link)}">Abrir firma demo</a></p><p>El enlace vence automáticamente.</p>`,
          headers: { "X-Entity-Ref-ID": deliveryKey },
        },
        { idempotencyKey: deliveryKey },
      );
      if (result.error) throw new Error("DEMO_EMAIL_PROVIDER_REJECTED");
      await finishDemoEmailDelivery({
        workspaceId: payload.workspaceId,
        idempotencyKey: deliveryKey,
        status: "sent",
        providerId: result.data?.id,
      });
      sent.push(recipient);
    } catch (error) {
      const errorCode =
        error instanceof Error && error.message === "DEMO_EMAIL_PROVIDER_REJECTED"
          ? "DEMO_EMAIL_PROVIDER_REJECTED"
          : "DEMO_EMAIL_PROVIDER_FAILED";
      await finishDemoEmailDelivery({
        workspaceId: payload.workspaceId,
        idempotencyKey: deliveryKey,
        status: "failed",
        errorCode,
      });
      throw new Error(errorCode);
    }
  }
  return { sent, duplicate };
}
