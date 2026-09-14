"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult<T = null> = { error?: string; data?: T };

/**
 * Download a CPE document (factura, boleta, or credit note).
 * Returns a private signed URL with 5-minute expiry.
 *
 * Only the owning realtor can download. Does not expose a public URL.
 * Uses admin client for invoice query and signed URL generation
 * since the tax-documents bucket has no authenticated storage policy.
 */
export async function downloadComprobanteAction(
  invoiceId: string,
): Promise<ActionResult<{ signedUrl: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const admin = createAdminClient();

  const { data: invoice, error } = await admin
    .from("invoices")
    .select("id, realtor_id, status, pdf_storage_path")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { error: "Comprobante no encontrado." };
  }

  if (invoice.realtor_id !== user.id) {
    return { error: "Comprobante no encontrado." };
  }

  if (invoice.status !== "available") {
    return { error: "El comprobante aún no está disponible para descarga." };
  }

  if (!invoice.pdf_storage_path) {
    return { error: "El PDF del comprobante aún no está listo." };
  }

  const { data: signedUrlData, error: signError } = await admin.storage
    .from("tax-documents")
    .createSignedUrl(invoice.pdf_storage_path, 300);

  if (signError || !signedUrlData?.signedUrl) {
    return { error: "No se pudo generar el enlace de descarga." };
  }

  return { data: { signedUrl: signedUrlData.signedUrl } };
}
