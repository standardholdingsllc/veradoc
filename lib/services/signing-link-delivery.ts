import "server-only";
import { sendEmail } from "./email-service";
import { signingLinkEmailHtml } from "./email-templates/signing-link";
import { sendWhatsAppSigningLink } from "./whatsapp-service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export interface DeliveryTarget {
  signerName: string;
  signerEmail: string;
  signerWhatsapp: string;
  signingUrl: string;
  packetId: string;
  realtorName: string;
  propertyAddress: string;
  expiresAt: string;
}

export interface DeliveryResult {
  emailStatus: string;
  whatsappStatus: string;
}

/**
 * Delivers a signing link to the signer via both email and WhatsApp,
 * then records delivery status in the audit log.
 */
export async function deliverSigningLink(
  target: DeliveryTarget,
): Promise<DeliveryResult> {
  const admin = createAdminClient();

  let emailStatus = "failed";
  try {
    const emailResult = await sendEmail({
      to: target.signerEmail,
      subject: "Invitación a firmar tu contrato — VeraDoc",
      html: signingLinkEmailHtml({
        signerName: target.signerName,
        realtorName: target.realtorName,
        propertyAddress: target.propertyAddress,
        signingUrl: target.signingUrl,
        expiresAt: target.expiresAt,
      }),
    });
    emailStatus = emailResult.status;
  } catch (err) {
    console.error("[signing-link-delivery] Email delivery failed:", err);
  }

  let whatsappStatus = "failed";
  try {
    const waResult = await sendWhatsAppSigningLink({
      phoneNumber: target.signerWhatsapp,
      signerName: target.signerName,
      signingUrl: target.signingUrl,
    });
    whatsappStatus = waResult.status;
  } catch (err) {
    console.error("[signing-link-delivery] WhatsApp delivery failed:", err);
  }

  await admin.from("packet_audit_log").insert({
    packet_id: target.packetId,
    actor_id: null,
    action: "signing_link_delivered",
    metadata: {
      signer_email: target.signerEmail,
      signer_whatsapp: target.signerWhatsapp,
      email_status: emailStatus,
      whatsapp_status: whatsappStatus,
    } as unknown as Json,
  });

  return { emailStatus, whatsappStatus };
}
