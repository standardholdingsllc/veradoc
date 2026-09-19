import { z } from "zod";

const email = z.string().email("Correo electrónico inválido").max(320);
const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(256);
const fullName = z.string().min(1, "Nombre requerido").max(200);
const dni = z.string().max(20);
const province = z.string().min(1, "Provincia requerida").max(100);
const optionalString = z.string().max(200).optional().default("");
const token = z.string().min(1, "Token requerido").max(256);
const uuid = z.string().uuid("ID inválido");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Contraseña requerida").max(256),
});

export const realtorSignupSchema = z.object({
  fullName,
  email,
  password,
  dni: dni.min(1, "DNI requerido"),
  licenseNumber: optionalString,
  province,
  department: optionalString,
  companyName: optionalString,
  ruc: optionalString,
  phone: optionalString,
});

export const approveRealtorSchema = z.object({
  userId: uuid,
  province,
});

export const rejectRealtorSchema = z.object({
  userId: uuid,
  reason: z.string().max(500).optional().default(""),
});

export const createSignerAccountSchema = z.object({
  token,
  email,
  password,
});

export const addCoverageSchema = z.object({
  notaryId: uuid,
  province: z.string().min(1, "Provincia requerida").max(100),
  department: z.string().max(100).optional().default(""),
});

export const updateCoverageSchema = addCoverageSchema.extend({
  coverageId: uuid,
});

export const userActionSchema = z.object({
  userId: uuid,
});

export const googleRealtorSignupSchema = z.object({
  fullName,
  dni: dni.min(1, "DNI requerido"),
  licenseNumber: optionalString,
  province,
  department: optionalString,
  companyName: optionalString,
  ruc: optionalString,
  phone: optionalString,
});
