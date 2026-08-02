import "server-only";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WhatsAppSendResult {
  messageId: string;
  status: string;
}

export interface WhatsAppProvider {
  sendOtp(phoneNumber: string, otp: string): Promise<{ messageId: string }>;
}

// ---------------------------------------------------------------------------
// Signing link delivery via Meta Cloud API
// ---------------------------------------------------------------------------

/**
 * Sends a signing link to the signer via WhatsApp using Meta Cloud API
 * template messages. Requires pre-approved template "signing_link_invite".
 *
 * Returns { status: "not_configured" } if env vars are missing (graceful degradation).
 */
export async function sendWhatsAppSigningLink(params: {
  phoneNumber: string;
  signerName: string;
  signingUrl: string;
}): Promise<WhatsAppSendResult> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_API_TOKEN;

  if (!phoneId || !token) {
    console.warn(
      "[whatsapp-service] WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured — skipping send",
    );
    return { messageId: "skipped", status: "not_configured" };
  }

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.phoneNumber,
      type: "template",
      template: {
        name: "signing_link_invite",
        language: { code: "es" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: params.signerName },
              { type: "text", text: params.signingUrl },
            ],
          },
        ],
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
  }

  return {
    messageId: data.messages?.[0]?.id ?? "unknown",
    status: "sent",
  };
}

// ---------------------------------------------------------------------------
// OTP provider (used by Section 8 — WhatsApp OTP integration)
// ---------------------------------------------------------------------------

class DevWhatsAppProvider implements WhatsAppProvider {
  async sendOtp(phone: string, otp: string): Promise<{ messageId: string }> {
    console.log(`[DEV WhatsApp] OTP ${otp} → ${phone}`);
    return { messageId: `dev-${Date.now()}` };
  }
}

let _provider: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (!_provider) {
    _provider = new DevWhatsAppProvider();
  }
  return _provider;
}
