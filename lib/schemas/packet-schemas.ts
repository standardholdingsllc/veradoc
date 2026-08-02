import { z } from "zod";

export const signerInputSchema = z.object({
  roleInLease: z.enum(["landlord", "renter"]),
  fullName: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Correo electrónico inválido"),
  whatsapp: z
    .string()
    .regex(/^\+51\d{9}$/, "Número WhatsApp inválido (+51 y 9 dígitos)"),
  dni: z.string().regex(/^\d{8}$/, "DNI debe tener 8 dígitos"),
});

export const propertySchema = z.object({
  address: z.string().min(3, "Dirección requerida"),
  unit: z.string().optional(),
  district: z.string().min(1, "Distrito requerido"),
  province: z.string().min(1, "Provincia requerida"),
  department: z.string().min(1, "Departamento requerido"),
});

export const leaseTermsSchema = z.object({
  monthlyRent: z.number().positive("Renta mensual debe ser positiva"),
  depositAmount: z.number().min(0, "Depósito no puede ser negativo"),
  currency: z.literal("PEN"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  expirationDate: z.string().min(1, "Fecha de vencimiento requerida"),
  durationMonths: z.number().int().positive(),
  useType: z.enum(["residential", "commercial"]),
  notes: z.string().optional(),
});

export const createPacketSchema = z.object({
  packetId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileHash: z.string().min(1),
  property: propertySchema,
  leaseTerms: leaseTermsSchema,
  signers: z.array(signerInputSchema).min(1, "Al menos un firmante requerido"),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2, "Nombre requerido"),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  ruc: z.string().optional(),
});

export const updatePartyProfileSchema = z.object({
  full_name: z.string().min(1, "Nombre requerido"),
  phone: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, "Contraseña actual requerida"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

export type SignerInput = z.infer<typeof signerInputSchema>;
export type CreatePacketInput = z.infer<typeof createPacketSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePartyProfileInput = z.infer<typeof updatePartyProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
