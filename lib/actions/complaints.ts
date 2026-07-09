"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/services/email-service";
import { complaintConfirmationHtml } from "@/lib/services/email-templates/complaint-confirmation";

const complaintSchema = z.object({
  consumerName: z.string().min(2, "El nombre es obligatorio"),
  consumerDni: z
    .string()
    .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
  consumerEmail: z.string().email("Ingrese un correo electrónico válido"),
  consumerPhone: z.string().optional(),
  consumerAddress: z.string().optional(),
  consumerIsMinor: z.boolean().default(false),
  guardianName: z.string().optional(),
  guardianDni: z.string().optional(),
  complaintType: z.enum(["reclamo", "queja"], "Seleccione el tipo de registro"),
  productOrService: z.string().min(1, "Indique el producto o servicio"),
  orderNumber: z.string().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  description: z
    .string()
    .min(10, "La descripción debe tener al menos 10 caracteres"),
  requestedRemedy: z
    .string()
    .min(5, "Indique el pedido o solución esperada"),
  privacyConsent: z.literal(true, "Debe aceptar la política de privacidad"),
});

export type ComplaintInput = z.infer<typeof complaintSchema>;

export type ComplaintResult =
  | { success: true; code: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitComplaint(
  data: ComplaintInput,
): Promise<ComplaintResult> {
  const parsed = complaintSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Por favor corrija los errores en el formulario.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  const ua = h.get("user-agent");

  const supabase = createAdminClient();

  // Use type assertion because `complaints` table is new and not yet
  // in the generated database.types.ts (regenerate with `npm run db:types`)
  const { data: row, error } = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("complaints")
    .insert({
      consumer_name: parsed.data.consumerName,
      consumer_dni: parsed.data.consumerDni,
      consumer_email: parsed.data.consumerEmail,
      consumer_phone: parsed.data.consumerPhone || null,
      consumer_address: parsed.data.consumerAddress || null,
      consumer_is_minor: parsed.data.consumerIsMinor,
      guardian_name: parsed.data.guardianName || null,
      guardian_dni: parsed.data.guardianDni || null,
      complaint_type: parsed.data.complaintType,
      product_or_service: parsed.data.productOrService,
      order_number: parsed.data.orderNumber || null,
      amount: parsed.data.amount ?? null,
      description: parsed.data.description,
      requested_remedy: parsed.data.requestedRemedy,
      ip_address: ip,
      user_agent: ua,
    })
    .select("code")
    .single();

  if (error || !row) {
    console.error("Complaint insert error:", error);
    return {
      success: false,
      error:
        "Ocurrió un error al registrar su reclamo. Por favor intente nuevamente.",
    };
  }

  const code = (row as { code: string }).code;

  // DS 011-2011-PCM requires sending an immediate email confirmation
  try {
    await sendEmail({
      to: parsed.data.consumerEmail,
      subject: `Constancia de recepción — ${code}`,
      html: complaintConfirmationHtml({
        consumerName: parsed.data.consumerName,
        complaintCode: code,
        complaintType: parsed.data.complaintType,
        productOrService: parsed.data.productOrService,
        description: parsed.data.description,
        requestedRemedy: parsed.data.requestedRemedy,
        submittedAt: new Date().toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
      tags: [
        { name: "category", value: "complaint-confirmation" },
        { name: "complaint_code", value: code },
      ],
    });
  } catch (emailError) {
    console.error("Complaint confirmation email failed:", emailError);
  }

  return { success: true, code };
}
