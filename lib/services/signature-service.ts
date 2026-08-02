import "server-only";

import { isFirmEasyConfigured } from "@/lib/env/server";

export interface SignatureProvider {
  initiateSignature(params: {
    documentUrl: string;
    signerName: string;
    signerDni: string;
    signerEmail: string;
  }): Promise<{ sessionId: string; embedUrl?: string }>;

  getSignatureResult(sessionId: string): Promise<SignatureResult>;
}

export interface SignatureResult {
  success: boolean;
  signedPdfUrl?: string;
  signedDocumentHash?: string;
  certificate: {
    subject: string;
    issuer: string;
    serial: string;
    validFrom: string;
    validTo: string;
  };
  chainValidation: string;
  revocationResult: string;
  timestampResult: string;
  signatureValid: boolean;
  pdfIntegrityValid: boolean;
  rawData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// FirmEasy provider (production)
// ---------------------------------------------------------------------------

class FirmEasySignatureProvider implements SignatureProvider {
  async initiateSignature(_params: {
    documentUrl: string;
    signerName: string;
    signerDni: string;
    signerEmail: string;
  }): Promise<{ sessionId: string; embedUrl?: string }> {
    // FirmEasy document creation happens at packet level in sendSigningLinksAction.
    // This method is a no-op — the signer's FirmEasy link is looked up directly
    // in initiateSignatureAction from packet_signers.firmeasy_signer_link.
    return { sessionId: "firmeasy-managed" };
  }

  async getSignatureResult(documentToken: string): Promise<SignatureResult> {
    const { getFirmEasyClient } = await import("@/lib/services/firmeasy");
    const client = getFirmEasyClient();
    if (!client) {
      throw new Error("FirmEasy client not configured");
    }

    const doc = await client.getDocument(documentToken, ["signers", "tracking"]);

    const tracking = doc.tracking?.[0];
    const now = new Date().toISOString();

    return {
      success: doc.status === "signed" || doc.status === "completed",
      signedPdfUrl: doc.signed_file ?? undefined,
      signedDocumentHash: undefined,
      certificate: {
        subject: tracking?.certificate_subject ?? "N/A",
        issuer: tracking?.certificate_issuer ?? "N/A",
        serial: tracking?.certificate_serial ?? "N/A",
        validFrom: tracking?.certificate_valid_from ?? now,
        validTo: tracking?.certificate_valid_to ?? now,
      },
      chainValidation: tracking?.chain_validation ?? "unknown",
      revocationResult: tracking?.revocation_status ?? "unknown",
      timestampResult: tracking?.timestamp_authority ?? now,
      signatureValid: doc.status === "signed" || doc.status === "completed",
      pdfIntegrityValid: true,
      rawData: {
        provider: "firmeasy",
        documentToken: doc.token,
        tracking: doc.tracking ?? [],
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Dev stub (local development only)
// ---------------------------------------------------------------------------

class DevSignatureProvider implements SignatureProvider {
  async initiateSignature(params: {
    documentUrl: string;
    signerName: string;
    signerDni: string;
    signerEmail: string;
  }): Promise<{ sessionId: string; embedUrl?: string }> {
    console.log(`[DEV Signature] Initiating for ${params.signerName} (${params.signerDni})`);
    return {
      sessionId: `dev-sig-${Date.now()}`,
    };
  }

  async getSignatureResult(_sessionId: string): Promise<SignatureResult> {
    await new Promise((r) => setTimeout(r, 500));

    const now = new Date();
    const validFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return {
      success: true,
      signedDocumentHash: `dev-hash-${Date.now().toString(16)}`,
      certificate: {
        subject: "CN=FIRMA DIGITAL DEV,O=VERADOC DEV,C=PE",
        issuer: "CN=IOFE DEV CA,O=RENIEC DEV,C=PE",
        serial: `DEV-${Date.now()}`,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
      },
      chainValidation: "valid",
      revocationResult: "good",
      timestampResult: now.toISOString(),
      signatureValid: true,
      pdfIntegrityValid: true,
      rawData: {
        provider: "dev-stub",
        timestamp: now.toISOString(),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

let _provider: SignatureProvider | null = null;

export function getSignatureProvider(): SignatureProvider {
  if (!_provider) {
    if (isFirmEasyConfigured()) {
      _provider = new FirmEasySignatureProvider();
    } else {
      const allowStub =
        process.env.NODE_ENV === "development" ||
        process.env.FIRMEASY_ALLOW_DEV_STUB === "true";

      if (allowStub) {
        console.warn("[Signature] Using DevSignatureProvider — NOT for production use");
        _provider = new DevSignatureProvider();
      } else {
        throw new Error(
          "FATAL: FirmEasy is not configured and dev stub is not allowed in this environment. " +
            "Set FIRMEASY_API_BASE_URL or FIRMEASY_ALLOW_DEV_STUB=true.",
        );
      }
    }
  }
  return _provider;
}
