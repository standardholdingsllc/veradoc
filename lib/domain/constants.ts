import type { PacketStatus, SignerStatus, UserRole } from "./types";

export const PACKET_STATUS_CONFIG: Record<
  PacketStatus,
  {
    label: string;
    color: string;
    iconName: string;
    nextAction: string;
  }
> = {
  draft: {
    label: "Borrador",
    color: "gray",
    iconName: "FileEdit",
    nextAction: "Complete el formulario",
  },
  awaiting_payment: {
    label: "Pendiente de pago",
    color: "amber",
    iconName: "CreditCard",
    nextAction: "Realizar pago",
  },
  ready_to_send: {
    label: "Listo para enviar",
    color: "blue",
    iconName: "Send",
    nextAction: "Enviar a firmantes",
  },
  sent_to_signers: {
    label: "Enviado a firmantes",
    color: "blue",
    iconName: "Users",
    nextAction: "Esperar firmas",
  },
  partially_signed: {
    label: "Parcialmente firmado",
    color: "amber",
    iconName: "PenLine",
    nextAction: "Esperar firmas restantes",
  },
  all_signers_complete: {
    label: "Firmas completadas",
    color: "green",
    iconName: "CheckCircle",
    nextAction: "Generar expediente de evidencia",
  },
  evidence_report_generated: {
    label: "Expediente generado",
    color: "blue",
    iconName: "FileText",
    nextAction: "Enviar al notario",
  },
  ready_for_notary: {
    label: "Listo para notario",
    color: "purple",
    iconName: "Scale",
    nextAction: "Esperar revisión notarial",
  },
  under_notary_review: {
    label: "En revisión notarial",
    color: "purple",
    iconName: "Eye",
    nextAction: "Completar revisión",
  },
  certified: {
    label: "Certificado",
    color: "green",
    iconName: "ShieldCheck",
    nextAction: "Descargar contrato",
  },
  certified_with_observations: {
    label: "Certificado con observaciones",
    color: "green",
    iconName: "ShieldAlert",
    nextAction: "Descargar contrato",
  },
  needs_correction: {
    label: "Requiere corrección",
    color: "red",
    iconName: "AlertTriangle",
    nextAction: "Revisar observaciones",
  },
  rejected: {
    label: "Rechazado",
    color: "red",
    iconName: "XCircle",
    nextAction: "Consultar motivo de rechazo",
  },
  archived: {
    label: "Archivado",
    color: "gray",
    iconName: "Archive",
    nextAction: "Sin acciones disponibles",
  },
  renewal_available: {
    label: "Renovación disponible",
    color: "blue",
    iconName: "RefreshCw",
    nextAction: "Iniciar renovación",
  },
  renewal_in_progress: {
    label: "Renovación en curso",
    color: "amber",
    iconName: "RefreshCw",
    nextAction: "Completar renovación",
  },
};

export const SIGNER_STATUS_CONFIG: Record<
  SignerStatus,
  {
    label: string;
    color: string;
    iconName: string;
  }
> = {
  link_sent: {
    label: "Enlace enviado",
    color: "blue",
    iconName: "Mail",
  },
  link_opened: {
    label: "Enlace abierto",
    color: "blue",
    iconName: "ExternalLink",
  },
  otp_verified: {
    label: "OTP verificado",
    color: "green",
    iconName: "ShieldCheck",
  },
  account_created: {
    label: "Cuenta creada",
    color: "green",
    iconName: "UserPlus",
  },
  consent_accepted: {
    label: "Consentimiento aceptado",
    color: "green",
    iconName: "CheckSquare",
  },
  identity_uploaded: {
    label: "Identidad cargada",
    color: "amber",
    iconName: "IdCard",
  },
  identity_verified_demo: {
    label: "Identidad verificada",
    color: "green",
    iconName: "BadgeCheck",
  },
  lease_reviewed: {
    label: "Contrato revisado",
    color: "green",
    iconName: "FileSearch",
  },
  signature_started: {
    label: "Firma iniciada",
    color: "amber",
    iconName: "PenTool",
  },
  signed: {
    label: "Firmado",
    color: "green",
    iconName: "PenLine",
  },
  complete: {
    label: "Completo",
    color: "green",
    iconName: "CheckCircle2",
  },
  needs_correction: {
    label: "Requiere corrección",
    color: "red",
    iconName: "AlertTriangle",
  },
};

export const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    description: string;
    color: string;
  }
> = {
  notary: {
    label: "Notario/a",
    description: "Revisa el expediente de evidencia y certifica el contrato",
    color: "purple",
  },
  realtor: {
    label: "Agente inmobiliario",
    description: "Crea paquetes de arrendamiento y gestiona firmantes",
    color: "blue",
  },
  landlord: {
    label: "Arrendador/a",
    description: "Verifica identidad y firma el contrato de arrendamiento",
    color: "green",
  },
  renter: {
    label: "Arrendatario/a",
    description: "Verifica identidad y firma el contrato de arrendamiento",
    color: "teal",
  },
};
