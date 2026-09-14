import "server-only";
import { sendEmail, sendBatchEmails } from "./email-service";
import { realtorSignupConfirmationHtml } from "./email-templates/realtor-signup-confirmation";
import { realtorApprovedHtml } from "./email-templates/realtor-approved";
import { realtorRejectedHtml } from "./email-templates/realtor-rejected";
import { signerCompletionHtml } from "./email-templates/signer-completion";
import { allSignersCompleteHtml } from "./email-templates/all-signers-complete";
import { packetSubmittedToNotaryHtml } from "./email-templates/packet-submitted-to-notary";
import { packetCertifiedHtml } from "./email-templates/packet-certified";
import { packetNeedsCorrectionHtml, packetNeedsCorrectionPartyHtml } from "./email-templates/packet-needs-correction";
import { packetRejectedHtml, packetRejectedPartyHtml } from "./email-templates/packet-rejected";
import { paymentConfirmationHtml } from "./email-templates/payment-confirmation";
import { signerRejectedFirmEasyHtml } from "./email-templates/signer-rejected-firmeasy";
import { comprobanteAvailableHtml } from "./email-templates/comprobante-available";
import {
  packetArchivedHtml,
  packetServiceWindowReminderHtml,
} from "./email-templates/packet-service-window";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function notifyPacketServiceWindow(params: {
  email: string;
  recipientName: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  daysRemaining?: number;
  endsAt?: string;
  archived: boolean;
  idempotencyKey: string;
}) {
  const common = {
    recipientName: params.recipientName,
    packetCode: params.packetCode,
    propertyAddress: params.propertyAddress,
    dashboardUrl: `${getSiteUrl()}/agente/paquetes/${params.packetId}`,
  };
  return sendEmail({
    to: params.email,
    subject: params.archived
      ? `Paquete ${params.packetCode} archivado — VeraDoc`
      : `${params.daysRemaining} días para completar ${params.packetCode} — VeraDoc`,
    html: params.archived
      ? packetArchivedHtml(common)
      : packetServiceWindowReminderHtml({
          ...common,
          daysRemaining: params.daysRemaining ?? 0,
          endsAt: params.endsAt ?? "",
        }),
    idempotencyKey: params.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// Realtor lifecycle
// ---------------------------------------------------------------------------

export async function notifyRealtorSignupReceived(params: {
  email: string;
  fullName: string;
}) {
  return sendEmail({
    to: params.email,
    subject: "Solicitud recibida — VeraDoc",
    html: realtorSignupConfirmationHtml({ realtorName: params.fullName }),
  }).catch((err) => {
    console.error("[notifications] realtorSignupReceived failed:", err);
    return { id: "error", status: "failed" };
  });
}

export async function notifyRealtorApproved(params: {
  email: string;
  fullName: string;
}) {
  return sendEmail({
    to: params.email,
    subject: "¡Tu cuenta ha sido aprobada! — VeraDoc",
    html: realtorApprovedHtml({
      realtorName: params.fullName,
      loginUrl: `${getSiteUrl()}/auth/login`,
    }),
  }).catch((err) => {
    console.error("[notifications] realtorApproved failed:", err);
    return { id: "error", status: "failed" };
  });
}

export async function notifyRealtorRejected(params: {
  email: string;
  fullName: string;
  reason?: string;
}) {
  return sendEmail({
    to: params.email,
    subject: "Resultado de tu solicitud — VeraDoc",
    html: realtorRejectedHtml({
      realtorName: params.fullName,
      reason: params.reason,
    }),
  }).catch((err) => {
    console.error("[notifications] realtorRejected failed:", err);
    return { id: "error", status: "failed" };
  });
}

// ---------------------------------------------------------------------------
// Signer lifecycle
// ---------------------------------------------------------------------------

export async function notifySignerCompletion(params: {
  email: string;
  signerName: string;
  propertyAddress: string;
  roleInLease: "landlord" | "renter";
}) {
  const dashPath = params.roleInLease === "landlord"
    ? "/arrendador/contratos"
    : "/arrendatario/contratos";

  return sendEmail({
    to: params.email,
    subject: "Firma completada — VeraDoc",
    html: signerCompletionHtml({
      signerName: params.signerName,
      propertyAddress: params.propertyAddress,
      dashboardUrl: `${getSiteUrl()}${dashPath}`,
    }),
  }).catch((err) => {
    console.error("[notifications] signerCompletion failed:", err);
    return { id: "error", status: "failed" };
  });
}

export async function notifySignerRejectedFirmEasy(params: {
  realtorEmail: string;
  realtorName: string;
  signerName: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
}) {
  return sendEmail({
    to: params.realtorEmail,
    subject: `Firmante rechazó firmar — ${params.packetCode} — VeraDoc`,
    html: signerRejectedFirmEasyHtml({
      realtorName: params.realtorName,
      signerName: params.signerName,
      packetCode: params.packetCode,
      propertyAddress: params.propertyAddress,
      dashboardUrl: `${getSiteUrl()}/agente/paquetes/${params.packetId}`,
    }),
  }).catch((err) => {
    console.error("[notifications] signerRejectedFirmEasy failed:", err);
    return { id: "error", status: "failed" };
  });
}

// ---------------------------------------------------------------------------
// Packet lifecycle — Realtor notifications
// ---------------------------------------------------------------------------

export async function notifyAllSignersComplete(params: {
  realtorEmail: string;
  realtorName: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
}) {
  return sendEmail({
    to: params.realtorEmail,
    subject: `Todos firmaron — ${params.packetCode} — VeraDoc`,
    html: allSignersCompleteHtml({
      realtorName: params.realtorName,
      packetCode: params.packetCode,
      propertyAddress: params.propertyAddress,
      packetUrl: `${getSiteUrl()}/agente/paquetes/${params.packetId}`,
    }),
  }).catch((err) => {
    console.error("[notifications] allSignersComplete failed:", err);
    return { id: "error", status: "failed" };
  });
}

export async function notifyPacketNeedsCorrection(params: {
  realtorEmail: string;
  realtorName: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  reason: string;
  parties?: Array<{ email: string; name: string }>;
}) {
  const realtorEmail = sendEmail({
    to: params.realtorEmail,
    subject: `Paquete devuelto — ${params.packetCode} — VeraDoc`,
    html: packetNeedsCorrectionHtml({
      realtorName: params.realtorName,
      packetCode: params.packetCode,
      propertyAddress: params.propertyAddress,
      reason: params.reason,
      packetUrl: `${getSiteUrl()}/agente/paquetes/${params.packetId}`,
    }),
  }).catch((err) => {
    console.error("[notifications] packetNeedsCorrection failed:", err);
    return { id: "error", status: "failed" };
  });

  if (params.parties?.length) {
    const partyEmails = params.parties.map((p) => ({
      to: p.email,
      subject: `Contrato en revisión — ${params.packetCode} — VeraDoc`,
      html: packetNeedsCorrectionPartyHtml({
        partyName: p.name,
        packetCode: params.packetCode,
        propertyAddress: params.propertyAddress,
        realtorName: params.realtorName,
      }),
    }));
    void sendBatchEmails(partyEmails).catch((err) => {
      console.error("[notifications] packetNeedsCorrection parties failed:", err);
    });
  }

  return realtorEmail;
}

export async function notifyPacketRejected(params: {
  realtorEmail: string;
  realtorName: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  reason: string;
  parties?: Array<{ email: string; name: string }>;
}) {
  const realtorEmail = sendEmail({
    to: params.realtorEmail,
    subject: `Paquete rechazado — ${params.packetCode} — VeraDoc`,
    html: packetRejectedHtml({
      realtorName: params.realtorName,
      packetCode: params.packetCode,
      propertyAddress: params.propertyAddress,
      reason: params.reason,
    }),
  }).catch((err) => {
    console.error("[notifications] packetRejected failed:", err);
    return { id: "error", status: "failed" };
  });

  if (params.parties?.length) {
    const partyEmails = params.parties.map((p) => ({
      to: p.email,
      subject: `Contrato no aprobado — ${params.packetCode} — VeraDoc`,
      html: packetRejectedPartyHtml({
        partyName: p.name,
        packetCode: params.packetCode,
        propertyAddress: params.propertyAddress,
        realtorName: params.realtorName,
      }),
    }));
    void sendBatchEmails(partyEmails).catch((err) => {
      console.error("[notifications] packetRejected parties failed:", err);
    });
  }

  return realtorEmail;
}

/**
 * Recipient-level variants used by the durable outbox. They deliberately let
 * provider failures propagate so the claim can be retried, and every delivery
 * carries the outbox row id as its provider idempotency key.
 */
export async function notifyPacketNeedsCorrectionRecipient(params: {
  recipientEmail: string;
  recipientName: string;
  recipientRole: "realtor" | "landlord" | "renter";
  realtorName: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  reason: string;
  idempotencyKey: string;
}) {
  const isRealtor = params.recipientRole === "realtor";
  return sendEmail({
    to: params.recipientEmail,
    subject: isRealtor
      ? `Paquete devuelto — ${params.packetCode} — VeraDoc`
      : `Contrato en revisión — ${params.packetCode} — VeraDoc`,
    html: isRealtor
      ? packetNeedsCorrectionHtml({
          realtorName: params.recipientName,
          packetCode: params.packetCode,
          propertyAddress: params.propertyAddress,
          reason: params.reason,
          packetUrl: `${getSiteUrl()}/agente/paquetes/${params.packetId}`,
        })
      : packetNeedsCorrectionPartyHtml({
          partyName: params.recipientName,
          packetCode: params.packetCode,
          propertyAddress: params.propertyAddress,
          realtorName: params.realtorName,
        }),
    idempotencyKey: params.idempotencyKey,
  });
}

export async function notifyPacketRejectedRecipient(params: {
  recipientEmail: string;
  recipientName: string;
  recipientRole: "realtor" | "landlord" | "renter";
  realtorName: string;
  packetCode: string;
  propertyAddress: string;
  reason: string;
  idempotencyKey: string;
}) {
  const isRealtor = params.recipientRole === "realtor";
  return sendEmail({
    to: params.recipientEmail,
    subject: isRealtor
      ? `Paquete rechazado — ${params.packetCode} — VeraDoc`
      : `Contrato no aprobado — ${params.packetCode} — VeraDoc`,
    html: isRealtor
      ? packetRejectedHtml({
          realtorName: params.recipientName,
          packetCode: params.packetCode,
          propertyAddress: params.propertyAddress,
          reason: params.reason,
        })
      : packetRejectedPartyHtml({
          partyName: params.recipientName,
          packetCode: params.packetCode,
          propertyAddress: params.propertyAddress,
          realtorName: params.realtorName,
        }),
    idempotencyKey: params.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// Packet lifecycle — Notary notifications
// ---------------------------------------------------------------------------

export async function notifyPacketSubmittedToNotary(params: {
  notaryEmail: string;
  notaryName: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  realtorName: string;
}) {
  return sendEmail({
    to: params.notaryEmail,
    subject: `Nuevo paquete para revisión — ${params.packetCode} — VeraDoc`,
    html: packetSubmittedToNotaryHtml({
      notaryName: params.notaryName,
      packetCode: params.packetCode,
      propertyAddress: params.propertyAddress,
      realtorName: params.realtorName,
      reviewUrl: `${getSiteUrl()}/notario/paquetes/${params.packetId}`,
    }),
  }).catch((err) => {
    console.error("[notifications] packetSubmittedToNotary failed:", err);
    return { id: "error", status: "failed" };
  });
}

// ---------------------------------------------------------------------------
// Packet lifecycle — All parties (certification)
// ---------------------------------------------------------------------------

export async function notifyPacketCertified(params: {
  recipients: Array<{
    email: string;
    name: string;
    role: "realtor" | "landlord" | "renter";
  }>;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  idempotencyKey?: string;
}) {
  const emails = params.recipients.map((r) => {
    const dashPath = r.role === "realtor"
      ? `/agente/paquetes/${params.packetId}`
      : r.role === "landlord"
        ? `/arrendador/contratos/${params.packetId}`
        : `/arrendatario/contratos/${params.packetId}`;

    return {
      to: r.email,
      subject: `Contrato certificado — ${params.packetCode} — VeraDoc`,
      html: packetCertifiedHtml({
        recipientName: r.name,
        packetCode: params.packetCode,
        propertyAddress: params.propertyAddress,
        dashboardUrl: `${getSiteUrl()}${dashPath}`,
      }),
      tags: [
        { name: "event", value: "packet_certified" },
        { name: "packet_id", value: params.packetId },
        { name: "role", value: r.role },
      ],
    };
  });

  return sendBatchEmails(emails).catch((err) => {
    console.error("[notifications] packetCertified batch failed:", err);
    return { ids: [], status: "failed" };
  });
}

/**
 * Deliver one certification notification from the durable outbox.
 * Provider errors intentionally propagate so the worker can retry the row.
 */
export async function notifyPacketCertifiedRecipient(params: {
  email: string;
  name: string;
  role: "realtor" | "landlord" | "renter";
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  idempotencyKey: string;
}): Promise<{ id: string }> {
  const dashPath = params.role === "realtor"
    ? `/agente/paquetes/${params.packetId}`
    : params.role === "landlord"
      ? `/arrendador/contratos/${params.packetId}`
      : `/arrendatario/contratos/${params.packetId}`;

  return sendEmail({
    to: params.email,
    subject: `Contrato certificado — ${params.packetCode} — VeraDoc`,
    html: packetCertifiedHtml({
      recipientName: params.name,
      packetCode: params.packetCode,
      propertyAddress: params.propertyAddress,
      dashboardUrl: `${getSiteUrl()}${dashPath}`,
    }),
    tags: [
      { name: "event", value: "packet_certified" },
      { name: "packet_id", value: params.packetId },
      { name: "role", value: params.role },
    ],
    idempotencyKey: params.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Comprobante (CPE) availability
// ---------------------------------------------------------------------------

/**
 * Notify the realtor that their CPE document is available for download.
 *
 * IMPORTANT: This function must NOT catch errors. Delivery failures must
 * propagate to the outbox processor for proper retry handling.
 */
export async function notifyComprobanteAvailable(params: {
  realtorEmail: string;
  realtorName: string;
  tipoDoc: string;
  documentNumber: string;
  packetCode: string;
  packetId: string;
  propertyAddress: string;
  idempotencyKey?: string;
}): Promise<{ id: string }> {
  const siteUrl = getSiteUrl();

  return sendEmail({
    to: params.realtorEmail,
    subject: `Comprobante disponible — ${params.documentNumber} — VeraDoc`,
    html: comprobanteAvailableHtml({
      recipientName: params.realtorName,
      tipoDoc: params.tipoDoc,
      documentNumber: params.documentNumber,
      packetCode: params.packetCode,
      propertyAddress: params.propertyAddress,
      dashboardUrl: `${siteUrl}/agente/paquetes/${params.packetId}`,
    }),
    idempotencyKey: params.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export async function notifyPaymentConfirmation(params: {
  realtorEmail: string;
  realtorName: string;
  packetCode: string;
  propertyAddress: string;
  amount: string;
  providerPaymentId: string;
  idempotencyKey?: string;
}) {
  return sendEmail({
    to: params.realtorEmail,
    subject: `Pago confirmado — ${params.packetCode} — VeraDoc`,
    html: paymentConfirmationHtml({
      realtorName: params.realtorName,
      packetCode: params.packetCode,
      amount: params.amount,
      providerPaymentId: params.providerPaymentId,
      propertyAddress: params.propertyAddress,
    }),
    idempotencyKey: params.idempotencyKey,
  }).catch((err) => {
    console.error("[notifications] paymentConfirmation failed:", err);
    return { id: "error", status: "failed" };
  });
}
