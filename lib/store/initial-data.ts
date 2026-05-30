// ALL PERSONAL DATA IN THIS FILE IS ENTIRELY FICTIONAL.
// DNI numbers use the non-issued 00xxxxxx range to prevent collision with real Peruvian identities.
// Names are common Peruvian name patterns and do not reference real public figures.

import type {
  AuditEvent,
  EvidenceReport,
  LeasePacket,
  RegistryEntry,
  SignatureEvidence,
  Signer,
  User,
} from "@/lib/domain/types";

// ─── Shared IDs ───────────────────────────────────────────────────────────────

export const USER_IDS = {
  realtor: "usr-realtor-diego",
  notary: "usr-notary-salazar",
  landlordMaria: "usr-landlord-maria",
  landlordJorge: "usr-landlord-jorge",
  renterCarlos: "usr-renter-carlos",
  renterAna: "usr-renter-ana",
} as const;

const DEVICE = "Chrome 120 / Windows 11 / Lima, Perú";
const DEVICE_MOBILE = "Safari 17 / iPhone 15 / Lima, Perú";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function audit(
  id: string,
  packetId: string,
  actorId: string,
  actorRole: string,
  eventType: string,
  eventLabel: string,
  timestamp: string,
  ip = "192.168.1.10",
  device = DEVICE,
  metadata?: Record<string, string>,
): AuditEvent {
  return {
    id,
    packetId,
    actorId,
    actorRole,
    eventType,
    eventLabel,
    timestamp,
    ipAddressPlaceholder: ip,
    devicePlaceholder: device,
    metadata,
  };
}

function iofeSignature(
  fullName: string,
  dni: string,
  signedAt: string,
  documentHash: string,
): SignatureEvidence {
  return {
    providerName: "IOFE Certificado Digital",
    signatureStatus: "valid",
    certificateSubject: `CN=${fullName}, SERIALNUMBER=DNI-${dni}, O=Persona Natural, C=PE`,
    certificateIssuer:
      "CN=IOFE CA Producción, O=Instituto de Ofimática Empresarial S.A., C=PE",
    certificateSerial: `IOFE-${dni.slice(0, 4)}-${Date.parse(signedAt).toString(36).toUpperCase()}`,
    certificateValidityStart: "2023-06-01T00:00:00.000Z",
    certificateValidityEnd: "2025-06-01T23:59:59.000Z",
    certificateChainResult: "valid",
    revocationResult: "good",
    timestampResult: "valid",
    pdfIntegrityResult: "intact",
    signedAt,
    finalDocumentHash: documentHash,
  };
}

function completeSigner(
  id: string,
  role: "landlord" | "renter",
  fullName: string,
  email: string,
  whatsapp: string,
  dni: string,
  token: string,
  signedAt: string,
  documentHash: string,
  auditEvents: AuditEvent[],
): Signer {
  return {
    id,
    roleInLease: role,
    fullName,
    email,
    whatsapp,
    dni,
    status: "complete",
    secureLinkToken: token,
    otpStatus: "verified",
    accountCreated: true,
    consentAccepted: true,
    consentTimestamp: auditEvents.find((e) => e.eventType === "consent_accepted")
      ?.timestamp,
    identityEvidence: {
      dniFrontStatus: "verified_demo",
      dniBackStatus: "verified_demo",
      selfieLivenessStatus: "verified_demo",
      reviewStatus: "passed_demo",
      uploadedAt: auditEvents.find((e) => e.eventType === "identity_uploaded")
        ?.timestamp,
    },
    signatureEvidence: iofeSignature(fullName, dni, signedAt, documentHash),
    auditEvents,
  };
}

function buildEvidenceReport(
  packet: LeasePacket,
  generatedAt: string,
  status: EvidenceReport["status"],
  duplicateMatch = false,
  duplicateDetails?: string,
): EvidenceReport {
  const hashHistory = packet.documentHashes;
  return {
    id: `evr-${packet.packetCode.toLowerCase()}`,
    packetId: packet.id,
    generatedAt,
    status,
    documentHashHistory: hashHistory,
    signerEvidenceSummaries: packet.signers.map((s) => ({
      signerId: s.id,
      identityStatus: s.identityEvidence.reviewStatus,
      signatureStatus: s.signatureEvidence?.signatureStatus ?? "pending",
      consentStatus: s.consentAccepted ? "accepted" : "pending",
    })),
    otpRecords: packet.signers.map((s) => {
      const sent = s.auditEvents.find((e) => e.eventType === "otp_sent");
      const verified = s.auditEvents.find((e) => e.eventType === "otp_verified");
      return {
        signerId: s.id,
        channel: "whatsapp",
        sentAt: sent?.timestamp ?? generatedAt,
        verifiedAt: verified?.timestamp ?? generatedAt,
      };
    }),
    consentRecords: packet.signers.map((s) => {
      const evt = s.auditEvents.find((e) => e.eventType === "consent_accepted");
      return {
        signerId: s.id,
        consentType: "arrendamiento_digital",
        acceptedAt: evt?.timestamp ?? s.consentTimestamp ?? generatedAt,
        ip: evt?.ipAddressPlaceholder ?? "192.168.1.10",
        device: evt?.devicePlaceholder ?? DEVICE,
      };
    }),
    sessionLogs: packet.signers.map((s) => ({
      signerId: s.id,
      events: s.auditEvents,
    })),
    signatureValidationResults: packet.signers
      .filter((s) => s.signatureEvidence)
      .map((s) => ({
        signerId: s.id,
        result: "valid",
        details: s.signatureEvidence!,
      })),
    propertyAuthorityEvidence:
      packet.property.propertyAuthorityEvidence ??
      "Partida registral SUNARP verificada (demo)",
    duplicateRentalCheck: {
      checked: true,
      matchFound: duplicateMatch,
      details: duplicateDetails,
    },
    systemFlags: duplicateMatch ? ["duplicate_address_warning"] : [],
    summaryForNotary:
      "Expediente de evidencia completo. Identidades verificadas (demo), firmas digitales IOFE válidas, integridad documental intacta.",
  };
}

import { CHECKLIST } from "@/lib/i18n/labels";

const NOTARY_CHECKLIST = Object.entries(CHECKLIST).map(([itemKey, label]) => ({
  itemKey,
  label,
}));

// ─── Users ────────────────────────────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  {
    id: USER_IDS.realtor,
    role: "realtor",
    fullName: "Diego Alejandro Torres Rojas",
    email: "diego.torres@torresinmobiliaria.pe",
    phone: "+51 999 123 456",
    dni: "00112233",
    companyName: "Inmobiliaria Torres y Asociados",
    ruc: "20601234567",
    licenseNumber: "CPI-LIM-2019-4521",
    profileStatus: "active",
  },
  {
    id: USER_IDS.notary,
    role: "notary",
    fullName: "Dra. Patricia Fernanda Salazar Morales",
    email: "notaria@salazar.pe",
    phone: "+51 1 442 8877",
    dni: "00445566",
    companyName: "Notaría Salazar",
    accreditationNumber: "NOT-LIM-2015-0089",
    profileStatus: "active",
  },
  {
    id: USER_IDS.landlordMaria,
    role: "landlord",
    fullName: "María Elena Quispe Huamán",
    email: "maria.quispe@gmail.com",
    phone: "+51 987 654 321",
    dni: "00456789",
    profileStatus: "active",
  },
  {
    id: USER_IDS.landlordJorge,
    role: "landlord",
    fullName: "Jorge Luis Vargas Castillo",
    email: "jorge.vargas@outlook.pe",
    phone: "+51 976 543 210",
    dni: "00321654",
    profileStatus: "active",
  },
  {
    id: USER_IDS.renterCarlos,
    role: "renter",
    fullName: "Carlos Alberto Mendoza Vargas",
    email: "carlos.mendoza@yahoo.com",
    phone: "+51 965 432 109",
    dni: "00789456",
    profileStatus: "active",
  },
  {
    id: USER_IDS.renterAna,
    role: "renter",
    fullName: "Ana Lucía Paredes Soto",
    email: "ana.paredes@hotmail.com",
    phone: "+51 954 321 098",
    dni: "00654321",
    profileStatus: "active",
  },
];

// ─── Packets ──────────────────────────────────────────────────────────────────

export const MOCK_PACKETS: LeasePacket[] = [
  // PKT-2024-001 — sent_to_signers, landlord complete, renter at identity step
  {
    id: "pkt-2024-001",
    packetCode: "PKT-2024-001",
    version: 1,
    status: "sent_to_signers",
    createdAt: "2024-04-10T09:15:00.000Z",
    updatedAt: "2024-04-18T16:42:00.000Z",
    createdByRealtorId: USER_IDS.realtor,
    assignedNotaryId: USER_IDS.notary,
    leaseDocument: {
      fileName: "contrato-arrendamiento-larco-345.pdf",
      uploadedAt: "2024-04-10T09:20:00.000Z",
      initialHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    property: {
      address: "Av. Larco 345, Dept. 4B",
      district: "Miraflores",
      province: "Lima",
      department: "Lima",
      unit: "4B",
      reference: "Edificio Larco Park, frente al parque Kennedy",
      sunarpRecordPlaceholder: "Partida N° 11234567 — Zona Registral Lima",
      normalizedAddressKey: "av-larco-345-dept-4b-miraflores",
    },
    leaseTerms: {
      monthlyRent: 2800,
      depositAmount: 2800,
      currency: "PEN",
      startDate: "2024-05-01",
      expirationDate: "2025-04-30",
      durationMonths: 12,
      useType: "residential",
      notes: "Incluye estacionamiento N° 12",
    },
    signers: [
      completeSigner(
        "sig-001-landlord",
        "landlord",
        "María Elena Quispe Huamán",
        "maria.quispe@gmail.com",
        "+51 987 654 321",
        "00456789",
        "tok-maria-larco-001",
        "2024-04-15T14:22:00.000Z",
        "7d865e959b2466918cecdbdc0fa522fdae7a556817fc93b0eae03e6794b2c3d6",
        [
          audit("aud-001-m-1", "pkt-2024-001", USER_IDS.landlordMaria, "landlord", "link_opened", "Enlace de firma abierto", "2024-04-12T10:05:00.000Z", "192.168.1.45"),
          audit("aud-001-m-2", "pkt-2024-001", USER_IDS.landlordMaria, "landlord", "otp_sent", "OTP enviado por WhatsApp", "2024-04-12T10:06:00.000Z", "192.168.1.45"),
          audit("aud-001-m-3", "pkt-2024-001", USER_IDS.landlordMaria, "landlord", "otp_verified", "OTP verificado", "2024-04-12T10:08:00.000Z", "192.168.1.45"),
          audit("aud-001-m-4", "pkt-2024-001", USER_IDS.landlordMaria, "landlord", "consent_accepted", "Consentimiento aceptado", "2024-04-12T10:12:00.000Z", "192.168.1.45"),
          audit("aud-001-m-5", "pkt-2024-001", USER_IDS.landlordMaria, "landlord", "identity_uploaded", "Documentos de identidad cargados", "2024-04-12T10:18:00.000Z", "192.168.1.45"),
          audit("aud-001-m-6", "pkt-2024-001", USER_IDS.landlordMaria, "landlord", "signature_applied", "Firma digital aplicada", "2024-04-15T14:22:00.000Z", "192.168.1.45"),
        ],
      ),
      {
        id: "sig-001-renter",
        roleInLease: "renter",
        fullName: "Carlos Alberto Mendoza Vargas",
        email: "carlos.mendoza@yahoo.com",
        whatsapp: "+51 965 432 109",
        dni: "00789456",
        status: "identity_uploaded",
        secureLinkToken: "tok-carlos-larco-001",
        otpStatus: "verified",
        accountCreated: true,
        consentAccepted: true,
        consentTimestamp: "2024-04-16T11:30:00.000Z",
        identityEvidence: {
          dniFrontStatus: "uploaded",
          dniBackStatus: "uploaded",
          selfieLivenessStatus: "pending",
          reviewStatus: "pending",
          uploadedAt: "2024-04-18T16:40:00.000Z",
        },
        auditEvents: [
          audit("aud-001-c-1", "pkt-2024-001", USER_IDS.renterCarlos, "renter", "link_opened", "Enlace de firma abierto", "2024-04-16T11:00:00.000Z", "192.168.2.88", DEVICE_MOBILE),
          audit("aud-001-c-2", "pkt-2024-001", USER_IDS.renterCarlos, "renter", "otp_sent", "OTP enviado por WhatsApp", "2024-04-16T11:01:00.000Z", "192.168.2.88", DEVICE_MOBILE),
          audit("aud-001-c-3", "pkt-2024-001", USER_IDS.renterCarlos, "renter", "otp_verified", "OTP verificado", "2024-04-16T11:03:00.000Z", "192.168.2.88", DEVICE_MOBILE),
          audit("aud-001-c-4", "pkt-2024-001", USER_IDS.renterCarlos, "renter", "consent_accepted", "Consentimiento aceptado", "2024-04-16T11:30:00.000Z", "192.168.2.88", DEVICE_MOBILE),
          audit("aud-001-c-5", "pkt-2024-001", USER_IDS.renterCarlos, "renter", "identity_uploaded", "Documentos de identidad cargados", "2024-04-18T16:40:00.000Z", "192.168.2.88", DEVICE_MOBILE),
        ],
      },
    ],
    payment: {
      status: "paid",
      amount: 149,
      currency: "PEN",
      paidAt: "2024-04-10T10:05:00.000Z",
      paymentMethodPlaceholder: "Tarjeta Visa •••• 4242",
      invoiceStatus: "issued",
    },
    documentHashes: [
      {
        hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        stage: "initial_upload",
        algorithm: "SHA-256",
        timestamp: "2024-04-10T09:20:00.000Z",
        actorId: USER_IDS.realtor,
      },
    ],
    registryCheck: { status: "checked", matchFound: false },
    auditEvents: [
      audit("aud-001-p-1", "pkt-2024-001", USER_IDS.realtor, "realtor", "packet_created", "Paquete creado", "2024-04-10T09:15:00.000Z"),
      audit("aud-001-p-2", "pkt-2024-001", "system", "system", "payment_confirmed", "Pago confirmado", "2024-04-10T10:05:00.000Z"),
      audit("aud-001-p-3", "pkt-2024-001", USER_IDS.realtor, "realtor", "send_to_signers", "Enlaces enviados a firmantes", "2024-04-11T08:30:00.000Z"),
    ],
    factura: {
      status: "issued",
      numberPlaceholder: "F001-00012345",
      issuedAt: "2024-04-10T10:10:00.000Z",
      downloadUrlPlaceholder: "/demo/facturas/F001-00012345.pdf",
    },
    renewalEligibility: { eligible: false },
  },

  // PKT-2024-002 — ready_for_notary, all signers complete, evidence report generated
  (() => {
    const id = "pkt-2024-002";
    const postSignHash =
      "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";
    const landlordEvents = [
      audit("aud-002-j-1", id, USER_IDS.landlordJorge, "landlord", "link_opened", "Enlace de firma abierto", "2024-05-02T09:00:00.000Z", "192.168.3.12"),
      audit("aud-002-j-2", id, USER_IDS.landlordJorge, "landlord", "otp_sent", "OTP enviado por WhatsApp", "2024-05-02T09:01:00.000Z", "192.168.3.12"),
      audit("aud-002-j-3", id, USER_IDS.landlordJorge, "landlord", "otp_verified", "OTP verificado", "2024-05-02T09:03:00.000Z", "192.168.3.12"),
      audit("aud-002-j-4", id, USER_IDS.landlordJorge, "landlord", "consent_accepted", "Consentimiento aceptado", "2024-05-02T09:08:00.000Z", "192.168.3.12"),
      audit("aud-002-j-5", id, USER_IDS.landlordJorge, "landlord", "identity_uploaded", "Documentos de identidad cargados", "2024-05-02T09:15:00.000Z", "192.168.3.12"),
      audit("aud-002-j-6", id, USER_IDS.landlordJorge, "landlord", "signature_applied", "Firma digital aplicada", "2024-05-03T11:45:00.000Z", "192.168.3.12"),
    ];
    const renterEvents = [
      audit("aud-002-a-1", id, USER_IDS.renterAna, "renter", "link_opened", "Enlace de firma abierto", "2024-05-04T15:20:00.000Z", "192.168.4.55", DEVICE_MOBILE),
      audit("aud-002-a-2", id, USER_IDS.renterAna, "renter", "otp_sent", "OTP enviado por WhatsApp", "2024-05-04T15:21:00.000Z", "192.168.4.55", DEVICE_MOBILE),
      audit("aud-002-a-3", id, USER_IDS.renterAna, "renter", "otp_verified", "OTP verificado", "2024-05-04T15:23:00.000Z", "192.168.4.55", DEVICE_MOBILE),
      audit("aud-002-a-4", id, USER_IDS.renterAna, "renter", "consent_accepted", "Consentimiento aceptado", "2024-05-04T15:28:00.000Z", "192.168.4.55", DEVICE_MOBILE),
      audit("aud-002-a-5", id, USER_IDS.renterAna, "renter", "identity_uploaded", "Documentos de identidad cargados", "2024-05-04T15:35:00.000Z", "192.168.4.55", DEVICE_MOBILE),
      audit("aud-002-a-6", id, USER_IDS.renterAna, "renter", "signature_applied", "Firma digital aplicada", "2024-05-05T10:10:00.000Z", "192.168.4.55", DEVICE_MOBILE),
    ];
    const packet: LeasePacket = {
      id,
      packetCode: "PKT-2024-002",
      version: 1,
      status: "ready_for_notary",
      createdAt: "2024-04-28T14:00:00.000Z",
      updatedAt: "2024-05-06T09:00:00.000Z",
      createdByRealtorId: USER_IDS.realtor,
      assignedNotaryId: USER_IDS.notary,
      leaseDocument: {
        fileName: "contrato-arrendamiento-los-pinos-128.pdf",
        uploadedAt: "2024-04-28T14:05:00.000Z",
        initialHash:
          "f2a1b0c9d8e7f6543210987654321098765432109876543210987654321098",
      },
      finalSignedDocument: {
        fileName: "contrato-arrendamiento-los-pinos-128-firmado.pdf",
        hash: postSignHash,
        generatedAt: "2024-05-05T10:12:00.000Z",
      },
      property: {
        address: "Jr. Los Pinos 128",
        district: "San Isidro",
        province: "Lima",
        department: "Lima",
        reference: "Casa de dos pisos, acceso por portón negro",
        sunarpRecordPlaceholder: "Partida N° 12345678 — Zona Registral Lima",
        propertyAuthorityEvidence: "Escritura pública N° 4521-2018 — Notaría Salazar",
        normalizedAddressKey: "jr-los-pinos-128-san-isidro",
      },
      leaseTerms: {
        monthlyRent: 3500,
        depositAmount: 3500,
        currency: "PEN",
        startDate: "2024-06-01",
        expirationDate: "2025-05-31",
        durationMonths: 12,
        useType: "residential",
      },
      signers: [
        completeSigner(
          "sig-002-landlord",
          "landlord",
          "Jorge Luis Vargas Castillo",
          "jorge.vargas@outlook.pe",
          "+51 976 543 210",
          "00321654",
          "tok-jorge-pinos-002",
          "2024-05-03T11:45:00.000Z",
          postSignHash,
          landlordEvents,
        ),
        completeSigner(
          "sig-002-renter",
          "renter",
          "Ana Lucía Paredes Soto",
          "ana.paredes@hotmail.com",
          "+51 954 321 098",
          "00654321",
          "tok-ana-pinos-002",
          "2024-05-05T10:10:00.000Z",
          postSignHash,
          renterEvents,
        ),
      ],
      payment: {
        status: "paid",
        amount: 149,
        currency: "PEN",
        paidAt: "2024-04-28T14:30:00.000Z",
        paymentMethodPlaceholder: "Transferencia BCP",
        invoiceStatus: "issued",
      },
      documentHashes: [
        {
          hash: "f2a1b0c9d8e7f6543210987654321098765432109876543210987654321098",
          stage: "initial_upload",
          algorithm: "SHA-256",
          timestamp: "2024-04-28T14:05:00.000Z",
          actorId: USER_IDS.realtor,
        },
        {
          hash: postSignHash,
          stage: "post_signatures",
          algorithm: "SHA-256",
          timestamp: "2024-05-05T10:12:00.000Z",
          actorId: "system",
        },
      ],
      registryCheck: { status: "checked", matchFound: false },
      auditEvents: [
        audit("aud-002-p-1", id, USER_IDS.realtor, "realtor", "packet_created", "Paquete creado", "2024-04-28T14:00:00.000Z"),
        audit("aud-002-p-2", id, "system", "system", "payment_confirmed", "Pago confirmado", "2024-04-28T14:30:00.000Z"),
        audit("aud-002-p-3", id, USER_IDS.realtor, "realtor", "send_to_signers", "Enlaces enviados a firmantes", "2024-05-01T08:00:00.000Z"),
        audit("aud-002-p-4", id, "system", "system", "all_signers_complete", "Todas las firmas completadas", "2024-05-05T10:12:00.000Z"),
        audit("aud-002-p-5", id, "system", "system", "evidence_report_generated", "Expediente de evidencia generado", "2024-05-05T14:00:00.000Z"),
        audit("aud-002-p-6", id, USER_IDS.realtor, "realtor", "submit_to_notary", "Enviado al notario", "2024-05-06T09:00:00.000Z"),
      ],
      renewalEligibility: { eligible: false },
    };
    packet.evidenceReport = buildEvidenceReport(
      packet,
      "2024-05-05T14:00:00.000Z",
      "submitted",
    );
    return packet;
  })(),

  // PKT-2024-003 — under_notary_review, duplicate warning, checklist partially complete
  (() => {
    const id = "pkt-2024-003";
    const postSignHash =
      "cafebabefeedface0123456789abcdef0123456789abcdef0123456789abcdef";
    const packet: LeasePacket = {
      id,
      packetCode: "PKT-2024-003",
      version: 1,
      status: "under_notary_review",
      createdAt: "2024-05-15T10:00:00.000Z",
      updatedAt: "2024-06-10T11:30:00.000Z",
      createdByRealtorId: USER_IDS.realtor,
      assignedNotaryId: USER_IDS.notary,
      leaseDocument: {
        fileName: "contrato-arrendamiento-las-flores-892.pdf",
        uploadedAt: "2024-05-15T10:05:00.000Z",
        initialHash:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      finalSignedDocument: {
        fileName: "contrato-arrendamiento-las-flores-892-firmado.pdf",
        hash: postSignHash,
        generatedAt: "2024-05-28T16:00:00.000Z",
      },
      property: {
        address: "Calle Las Flores 892",
        district: "Barranco",
        province: "Lima",
        department: "Lima",
        reference: "Casa colonial restaurada, segundo piso",
        sunarpRecordPlaceholder: "Partida N° 13456789 — Zona Registral Lima",
        propertyAuthorityEvidence: "Escritura pública N° 8834-2016 — Notaría Salazar",
        normalizedAddressKey: "calle-las-flores-892-barranco",
      },
      leaseTerms: {
        monthlyRent: 2200,
        depositAmount: 2200,
        currency: "PEN",
        startDate: "2024-07-01",
        expirationDate: "2025-06-30",
        durationMonths: 12,
        useType: "residential",
      },
      signers: [
        completeSigner(
          "sig-003-landlord",
          "landlord",
          "María Elena Quispe Huamán",
          "maria.quispe@gmail.com",
          "+51 987 654 321",
          "00456789",
          "tok-maria-flores-003",
          "2024-05-22T10:00:00.000Z",
          postSignHash,
          [
            audit("aud-003-m-1", id, USER_IDS.landlordMaria, "landlord", "link_opened", "Enlace de firma abierto", "2024-05-20T09:00:00.000Z"),
            audit("aud-003-m-2", id, USER_IDS.landlordMaria, "landlord", "otp_sent", "OTP enviado por WhatsApp", "2024-05-20T09:01:00.000Z"),
            audit("aud-003-m-3", id, USER_IDS.landlordMaria, "landlord", "otp_verified", "OTP verificado", "2024-05-20T09:03:00.000Z"),
            audit("aud-003-m-4", id, USER_IDS.landlordMaria, "landlord", "consent_accepted", "Consentimiento aceptado", "2024-05-20T09:10:00.000Z"),
            audit("aud-003-m-5", id, USER_IDS.landlordMaria, "landlord", "identity_uploaded", "Documentos de identidad cargados", "2024-05-20T09:18:00.000Z"),
            audit("aud-003-m-6", id, USER_IDS.landlordMaria, "landlord", "signature_applied", "Firma digital aplicada", "2024-05-22T10:00:00.000Z"),
          ],
        ),
        completeSigner(
          "sig-003-renter",
          "renter",
          "Carlos Alberto Mendoza Vargas",
          "carlos.mendoza@yahoo.com",
          "+51 965 432 109",
          "00789456",
          "tok-carlos-flores-003",
          "2024-05-28T15:30:00.000Z",
          postSignHash,
          [
            audit("aud-003-c-1", id, USER_IDS.renterCarlos, "renter", "link_opened", "Enlace de firma abierto", "2024-05-25T14:00:00.000Z", "192.168.5.20", DEVICE_MOBILE),
            audit("aud-003-c-2", id, USER_IDS.renterCarlos, "renter", "otp_sent", "OTP enviado por WhatsApp", "2024-05-25T14:01:00.000Z", "192.168.5.20", DEVICE_MOBILE),
            audit("aud-003-c-3", id, USER_IDS.renterCarlos, "renter", "otp_verified", "OTP verificado", "2024-05-25T14:03:00.000Z", "192.168.5.20", DEVICE_MOBILE),
            audit("aud-003-c-4", id, USER_IDS.renterCarlos, "renter", "consent_accepted", "Consentimiento aceptado", "2024-05-25T14:10:00.000Z", "192.168.5.20", DEVICE_MOBILE),
            audit("aud-003-c-5", id, USER_IDS.renterCarlos, "renter", "identity_uploaded", "Documentos de identidad cargados", "2024-05-25T14:20:00.000Z", "192.168.5.20", DEVICE_MOBILE),
            audit("aud-003-c-6", id, USER_IDS.renterCarlos, "renter", "signature_applied", "Firma digital aplicada", "2024-05-28T15:30:00.000Z", "192.168.5.20", DEVICE_MOBILE),
          ],
        ),
      ],
      payment: {
        status: "paid",
        amount: 149,
        currency: "PEN",
        paidAt: "2024-05-15T10:30:00.000Z",
        paymentMethodPlaceholder: "Tarjeta Mastercard •••• 5555",
        invoiceStatus: "issued",
      },
      documentHashes: [
        {
          hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          stage: "initial_upload",
          algorithm: "SHA-256",
          timestamp: "2024-05-15T10:05:00.000Z",
          actorId: USER_IDS.realtor,
        },
        {
          hash: postSignHash,
          stage: "post_signatures",
          algorithm: "SHA-256",
          timestamp: "2024-05-28T16:00:00.000Z",
          actorId: "system",
        },
      ],
      registryCheck: {
        status: "duplicate_warning",
        matchFound: true,
        matchDetails:
          "Coincidencia con arrendamiento activo PKT-2023-089 en la misma dirección (calle-las-flores-892-barranco). Verificar si el contrato anterior fue desactivado.",
      },
      notaryReview: {
        status: "in_progress",
        reviewStartedAt: "2024-06-10T09:00:00.000Z",
        reviewChecklist: NOTARY_CHECKLIST.map((item, index) => ({
          ...item,
          checked: index < 3,
          checkedAt:
            index < 3 ? "2024-06-10T10:00:00.000Z" : undefined,
        })),
        observations:
          "Advertencia de arrendamiento duplicado detectada. Se requiere aclaración del agente inmobiliario sobre el estado del contrato PKT-2023-089.",
      },
      auditEvents: [
        audit("aud-003-p-1", id, USER_IDS.realtor, "realtor", "packet_created", "Paquete creado", "2024-05-15T10:00:00.000Z"),
        audit("aud-003-p-2", id, "system", "system", "payment_confirmed", "Pago confirmado", "2024-05-15T10:30:00.000Z"),
        audit("aud-003-p-3", id, USER_IDS.realtor, "realtor", "send_to_signers", "Enlaces enviados a firmantes", "2024-05-18T08:00:00.000Z"),
        audit("aud-003-p-4", id, "system", "system", "all_signers_complete", "Todas las firmas completadas", "2024-05-28T16:00:00.000Z"),
        audit("aud-003-p-5", id, "system", "system", "evidence_report_generated", "Expediente de evidencia generado", "2024-05-29T10:00:00.000Z"),
        audit("aud-003-p-6", id, USER_IDS.realtor, "realtor", "submit_to_notary", "Enviado al notario", "2024-06-01T09:00:00.000Z"),
        audit("aud-003-p-7", id, USER_IDS.notary, "notary", "start_review", "Revisión notarial iniciada", "2024-06-10T09:00:00.000Z", "192.168.10.5"),
        audit("aud-003-p-8", id, "system", "system", "duplicate_detected", "Advertencia de arrendamiento duplicado", "2024-06-10T09:05:00.000Z", "192.168.10.5", DEVICE, {
          matchedPacket: "PKT-2023-089",
          propertyKey: "calle-las-flores-892-barranco",
        }),
      ],
      renewalEligibility: { eligible: false },
    };
    packet.evidenceReport = buildEvidenceReport(
      packet,
      "2024-05-29T10:00:00.000Z",
      "under_review",
      true,
      "Arrendamiento activo registrado: PKT-2023-089 — Calle Las Flores 892, Barranco. Vigencia 01/03/2023 – 29/02/2024 (plazo vencido, registro aún activo).",
    );
    return packet;
  })(),

  // PKT-2024-004 — certified, registry entry active
  (() => {
    const id = "pkt-2024-004";
    const postSignHash =
      "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567";
    const certifiedHash =
      "beefdead0123456789abcdef0123456789abcdef0123456789abcdef01234567";
    const packet: LeasePacket = {
      id,
      packetCode: "PKT-2024-004",
      version: 1,
      status: "certified",
      createdAt: "2024-03-01T08:00:00.000Z",
      updatedAt: "2024-03-25T17:00:00.000Z",
      createdByRealtorId: USER_IDS.realtor,
      assignedNotaryId: USER_IDS.notary,
      leaseDocument: {
        fileName: "contrato-arrendamiento-primavera-567.pdf",
        uploadedAt: "2024-03-01T08:05:00.000Z",
        initialHash:
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      },
      finalSignedDocument: {
        fileName: "contrato-arrendamiento-primavera-567-firmado.pdf",
        hash: postSignHash,
        generatedAt: "2024-03-12T14:00:00.000Z",
      },
      certifiedDocument: {
        fileName: "contrato-arrendamiento-primavera-567-certificado.pdf",
        hash: certifiedHash,
        certifiedAt: "2024-03-25T16:45:00.000Z",
      },
      property: {
        address: "Av. Primavera 567",
        district: "Santiago de Surco",
        province: "Lima",
        department: "Lima",
        reference: "Departamento 302, Condominio Primavera Verde",
        sunarpRecordPlaceholder: "Partida N° 14567890 — Zona Registral Lima",
        propertyAuthorityEvidence: "Escritura pública N° 2210-2019 — Notaría Salazar",
        normalizedAddressKey: "av-primavera-567-surco",
      },
      leaseTerms: {
        monthlyRent: 2400,
        depositAmount: 2400,
        currency: "PEN",
        startDate: "2024-04-01",
        expirationDate: "2025-03-31",
        durationMonths: 12,
        useType: "residential",
      },
      signers: [
        completeSigner(
          "sig-004-landlord",
          "landlord",
          "Jorge Luis Vargas Castillo",
          "jorge.vargas@outlook.pe",
          "+51 976 543 210",
          "00321654",
          "tok-jorge-primavera-004",
          "2024-03-10T11:00:00.000Z",
          postSignHash,
          [
            audit("aud-004-j-1", id, USER_IDS.landlordJorge, "landlord", "link_opened", "Enlace de firma abierto", "2024-03-08T10:00:00.000Z"),
            audit("aud-004-j-2", id, USER_IDS.landlordJorge, "landlord", "otp_sent", "OTP enviado por WhatsApp", "2024-03-08T10:01:00.000Z"),
            audit("aud-004-j-3", id, USER_IDS.landlordJorge, "landlord", "otp_verified", "OTP verificado", "2024-03-08T10:03:00.000Z"),
            audit("aud-004-j-4", id, USER_IDS.landlordJorge, "landlord", "consent_accepted", "Consentimiento aceptado", "2024-03-08T10:08:00.000Z"),
            audit("aud-004-j-5", id, USER_IDS.landlordJorge, "landlord", "identity_uploaded", "Documentos de identidad cargados", "2024-03-08T10:15:00.000Z"),
            audit("aud-004-j-6", id, USER_IDS.landlordJorge, "landlord", "signature_applied", "Firma digital aplicada", "2024-03-10T11:00:00.000Z"),
          ],
        ),
        completeSigner(
          "sig-004-renter",
          "renter",
          "Ana Lucía Paredes Soto",
          "ana.paredes@hotmail.com",
          "+51 954 321 098",
          "00654321",
          "tok-ana-primavera-004",
          "2024-03-12T13:30:00.000Z",
          postSignHash,
          [
            audit("aud-004-a-1", id, USER_IDS.renterAna, "renter", "link_opened", "Enlace de firma abierto", "2024-03-11T16:00:00.000Z", "192.168.6.33", DEVICE_MOBILE),
            audit("aud-004-a-2", id, USER_IDS.renterAna, "renter", "otp_sent", "OTP enviado por WhatsApp", "2024-03-11T16:01:00.000Z", "192.168.6.33", DEVICE_MOBILE),
            audit("aud-004-a-3", id, USER_IDS.renterAna, "renter", "otp_verified", "OTP verificado", "2024-03-11T16:03:00.000Z", "192.168.6.33", DEVICE_MOBILE),
            audit("aud-004-a-4", id, USER_IDS.renterAna, "renter", "consent_accepted", "Consentimiento aceptado", "2024-03-11T16:08:00.000Z", "192.168.6.33", DEVICE_MOBILE),
            audit("aud-004-a-5", id, USER_IDS.renterAna, "renter", "identity_uploaded", "Documentos de identidad cargados", "2024-03-11T16:15:00.000Z", "192.168.6.33", DEVICE_MOBILE),
            audit("aud-004-a-6", id, USER_IDS.renterAna, "renter", "signature_applied", "Firma digital aplicada", "2024-03-12T13:30:00.000Z", "192.168.6.33", DEVICE_MOBILE),
          ],
        ),
      ],
      payment: {
        status: "paid",
        amount: 149,
        currency: "PEN",
        paidAt: "2024-03-01T08:30:00.000Z",
        paymentMethodPlaceholder: "Yape",
        invoiceStatus: "issued",
      },
      documentHashes: [
        {
          hash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
          stage: "initial_upload",
          algorithm: "SHA-256",
          timestamp: "2024-03-01T08:05:00.000Z",
          actorId: USER_IDS.realtor,
        },
        {
          hash: postSignHash,
          stage: "post_signatures",
          algorithm: "SHA-256",
          timestamp: "2024-03-12T14:00:00.000Z",
          actorId: "system",
        },
        {
          hash: certifiedHash,
          stage: "final_certified",
          algorithm: "SHA-256",
          timestamp: "2024-03-25T16:45:00.000Z",
          actorId: USER_IDS.notary,
        },
      ],
      registryCheck: { status: "registered", matchFound: false },
      notaryReview: {
        status: "complete",
        reviewStartedAt: "2024-03-20T09:00:00.000Z",
        reviewCompletedAt: "2024-03-25T16:45:00.000Z",
        reviewChecklist: NOTARY_CHECKLIST.map((item) => ({
          ...item,
          checked: true,
          checkedAt: "2024-03-25T15:00:00.000Z",
        })),
        decision: "certify",
        certificationTextPlaceholder:
          "Certifico que el presente contrato de arrendamiento ha sido suscrito mediante firmas digitales IOFE válidas, conforme a la Ley N° 27269.",
        certifiedAt: "2024-03-25T16:45:00.000Z",
      },
      auditEvents: [
        audit("aud-004-p-1", id, USER_IDS.realtor, "realtor", "packet_created", "Paquete creado", "2024-03-01T08:00:00.000Z"),
        audit("aud-004-p-2", id, "system", "system", "payment_confirmed", "Pago confirmado", "2024-03-01T08:30:00.000Z"),
        audit("aud-004-p-3", id, USER_IDS.realtor, "realtor", "send_to_signers", "Enlaces enviados a firmantes", "2024-03-05T08:00:00.000Z"),
        audit("aud-004-p-4", id, "system", "system", "all_signers_complete", "Todas las firmas completadas", "2024-03-12T14:00:00.000Z"),
        audit("aud-004-p-5", id, "system", "system", "evidence_report_generated", "Expediente de evidencia generado", "2024-03-13T10:00:00.000Z"),
        audit("aud-004-p-6", id, USER_IDS.realtor, "realtor", "submit_to_notary", "Enviado al notario", "2024-03-15T09:00:00.000Z"),
        audit("aud-004-p-7", id, USER_IDS.notary, "notary", "start_review", "Revisión notarial iniciada", "2024-03-20T09:00:00.000Z", "192.168.10.5"),
        audit("aud-004-p-8", id, USER_IDS.notary, "notary", "certify", "Contrato certificado", "2024-03-25T16:45:00.000Z", "192.168.10.5"),
        audit("aud-004-p-9", id, "system", "system", "registry_entry_created", "Entrada de registro creada", "2024-03-25T17:00:00.000Z"),
      ],
      renewalEligibility: { eligible: true, availableAfter: "2025-02-01" },
    };
    packet.evidenceReport = buildEvidenceReport(
      packet,
      "2024-03-13T10:00:00.000Z",
      "submitted",
    );
    return packet;
  })(),

  // PKT-2024-005 — needs_correction, selfie issue
  (() => {
    const id = "pkt-2024-005";
    const postSignHash =
      "facade0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const packet: LeasePacket = {
      id,
      packetCode: "PKT-2024-005",
      version: 1,
      status: "needs_correction",
      createdAt: "2024-06-01T11:00:00.000Z",
      updatedAt: "2024-06-20T14:00:00.000Z",
      createdByRealtorId: USER_IDS.realtor,
      assignedNotaryId: USER_IDS.notary,
      leaseDocument: {
        fileName: "contrato-arrendamiento-camana-456.pdf",
        uploadedAt: "2024-06-01T11:05:00.000Z",
        initialHash:
          "13579bdf02468ace13579bdf02468ace13579bdf02468ace13579bdf02468ace",
      },
      finalSignedDocument: {
        fileName: "contrato-arrendamiento-camana-456-firmado.pdf",
        hash: postSignHash,
        generatedAt: "2024-06-15T12:00:00.000Z",
      },
      property: {
        address: "Jr. Camaná 456",
        district: "Jesús María",
        province: "Lima",
        department: "Lima",
        reference: "Local comercial en primer piso",
        sunarpRecordPlaceholder: "Partida N° 15678901 — Zona Registral Lima",
        normalizedAddressKey: "jr-camana-456-jesus-maria",
      },
      leaseTerms: {
        monthlyRent: 1800,
        depositAmount: 3600,
        currency: "PEN",
        startDate: "2024-07-01",
        expirationDate: "2025-06-30",
        durationMonths: 12,
        useType: "commercial",
        notes: "Uso comercial — cafetería",
      },
      signers: [
        completeSigner(
          "sig-005-landlord",
          "landlord",
          "María Elena Quispe Huamán",
          "maria.quispe@gmail.com",
          "+51 987 654 321",
          "00456789",
          "tok-maria-camana-005",
          "2024-06-10T10:00:00.000Z",
          postSignHash,
          [
            audit("aud-005-m-1", id, USER_IDS.landlordMaria, "landlord", "link_opened", "Enlace de firma abierto", "2024-06-08T09:00:00.000Z"),
            audit("aud-005-m-2", id, USER_IDS.landlordMaria, "landlord", "otp_sent", "OTP enviado por WhatsApp", "2024-06-08T09:01:00.000Z"),
            audit("aud-005-m-3", id, USER_IDS.landlordMaria, "landlord", "otp_verified", "OTP verificado", "2024-06-08T09:03:00.000Z"),
            audit("aud-005-m-4", id, USER_IDS.landlordMaria, "landlord", "consent_accepted", "Consentimiento aceptado", "2024-06-08T09:08:00.000Z"),
            audit("aud-005-m-5", id, USER_IDS.landlordMaria, "landlord", "identity_uploaded", "Documentos de identidad cargados", "2024-06-08T09:15:00.000Z"),
            audit("aud-005-m-6", id, USER_IDS.landlordMaria, "landlord", "signature_applied", "Firma digital aplicada", "2024-06-10T10:00:00.000Z"),
          ],
        ),
        {
          id: "sig-005-renter",
          roleInLease: "renter",
          fullName: "Carlos Alberto Mendoza Vargas",
          email: "carlos.mendoza@yahoo.com",
          whatsapp: "+51 965 432 109",
          dni: "00789456",
          status: "needs_correction",
          secureLinkToken: "tok-carlos-camana-005",
          otpStatus: "verified",
          accountCreated: true,
          consentAccepted: true,
          consentTimestamp: "2024-06-12T10:00:00.000Z",
          identityEvidence: {
            dniFrontStatus: "verified_demo",
            dniBackStatus: "verified_demo",
            selfieLivenessStatus: "completed",
            reviewStatus: "needs_review",
            uploadedAt: "2024-06-12T10:30:00.000Z",
            flags: ["selfie_blurry", "face_match_low_confidence"],
          },
          signatureEvidence: iofeSignature(
            "Carlos Alberto Mendoza Vargas",
            "00789456",
            "2024-06-15T11:30:00.000Z",
            postSignHash,
          ),
          auditEvents: [
            audit("aud-005-c-1", id, USER_IDS.renterCarlos, "renter", "link_opened", "Enlace de firma abierto", "2024-06-12T09:00:00.000Z", "192.168.7.44", DEVICE_MOBILE),
            audit("aud-005-c-2", id, USER_IDS.renterCarlos, "renter", "otp_sent", "OTP enviado por WhatsApp", "2024-06-12T09:01:00.000Z", "192.168.7.44", DEVICE_MOBILE),
            audit("aud-005-c-3", id, USER_IDS.renterCarlos, "renter", "otp_verified", "OTP verificado", "2024-06-12T09:03:00.000Z", "192.168.7.44", DEVICE_MOBILE),
            audit("aud-005-c-4", id, USER_IDS.renterCarlos, "renter", "consent_accepted", "Consentimiento aceptado", "2024-06-12T10:00:00.000Z", "192.168.7.44", DEVICE_MOBILE),
            audit("aud-005-c-5", id, USER_IDS.renterCarlos, "renter", "identity_uploaded", "Documentos de identidad cargados", "2024-06-12T10:30:00.000Z", "192.168.7.44", DEVICE_MOBILE),
            audit("aud-005-c-6", id, USER_IDS.renterCarlos, "renter", "signature_applied", "Firma digital aplicada", "2024-06-15T11:30:00.000Z", "192.168.7.44", DEVICE_MOBILE),
          ],
        },
      ],
      payment: {
        status: "paid",
        amount: 149,
        currency: "PEN",
        paidAt: "2024-06-01T11:30:00.000Z",
        paymentMethodPlaceholder: "Tarjeta Visa •••• 4242",
        invoiceStatus: "issued",
      },
      documentHashes: [
        {
          hash: "13579bdf02468ace13579bdf02468ace13579bdf02468ace13579bdf02468ace",
          stage: "initial_upload",
          algorithm: "SHA-256",
          timestamp: "2024-06-01T11:05:00.000Z",
          actorId: USER_IDS.realtor,
        },
        {
          hash: postSignHash,
          stage: "post_signatures",
          algorithm: "SHA-256",
          timestamp: "2024-06-15T12:00:00.000Z",
          actorId: "system",
        },
      ],
      registryCheck: { status: "checked", matchFound: false },
      notaryReview: {
        status: "complete",
        reviewStartedAt: "2024-06-18T09:00:00.000Z",
        reviewCompletedAt: "2024-06-20T14:00:00.000Z",
        reviewChecklist: NOTARY_CHECKLIST.map((item) => ({
          ...item,
          checked: item.itemKey !== "identity_verification",
          checkedAt:
            item.itemKey !== "identity_verification"
              ? "2024-06-20T13:00:00.000Z"
              : undefined,
        })),
        decision: "return_for_correction",
        correctionScope: "identity_recheck",
        correctionReason: "Selfie de DNI poco clara",
        observations:
          "La selfie de verificación del arrendatario Carlos Alberto Mendoza Vargas presenta baja nitidez. Se solicita recaptura con mejor iluminación.",
      },
      auditEvents: [
        audit("aud-005-p-1", id, USER_IDS.realtor, "realtor", "packet_created", "Paquete creado", "2024-06-01T11:00:00.000Z"),
        audit("aud-005-p-2", id, "system", "system", "payment_confirmed", "Pago confirmado", "2024-06-01T11:30:00.000Z"),
        audit("aud-005-p-3", id, USER_IDS.realtor, "realtor", "send_to_signers", "Enlaces enviados a firmantes", "2024-06-05T08:00:00.000Z"),
        audit("aud-005-p-4", id, "system", "system", "all_signers_complete", "Todas las firmas completadas", "2024-06-15T12:00:00.000Z"),
        audit("aud-005-p-5", id, "system", "system", "evidence_report_generated", "Expediente de evidencia generado", "2024-06-16T10:00:00.000Z"),
        audit("aud-005-p-6", id, USER_IDS.realtor, "realtor", "submit_to_notary", "Enviado al notario", "2024-06-17T09:00:00.000Z"),
        audit("aud-005-p-7", id, USER_IDS.notary, "notary", "start_review", "Revisión notarial iniciada", "2024-06-18T09:00:00.000Z", "192.168.10.5"),
        audit("aud-005-p-8", id, USER_IDS.notary, "notary", "return_for_correction", "Devuelto para corrección", "2024-06-20T14:00:00.000Z", "192.168.10.5", DEVICE, {
          reason: "Selfie de DNI poco clara",
        }),
      ],
      renewalEligibility: { eligible: false },
    };
    packet.evidenceReport = buildEvidenceReport(
      packet,
      "2024-06-16T10:00:00.000Z",
      "under_review",
    );
    packet.evidenceReport.systemFlags = ["identity_review_flagged"];
    packet.evidenceReport.summaryForNotary =
      "Expediente completo con observación en verificación de identidad del arrendatario: selfie con baja nitidez.";
    return packet;
  })(),

  // PKT-2024-006 — certified_with_observations, SUNARP observation
  (() => {
    const id = "pkt-2024-006";
    const postSignHash =
      "0badf00d0123456789abcdef0123456789abcdef0123456789abcdef01234567a";
    const certifiedHash =
      "0cafef00d0123456789abcdef0123456789abcdef0123456789abcdef01234567b";
    const packet: LeasePacket = {
      id,
      packetCode: "PKT-2024-006",
      version: 1,
      status: "certified_with_observations",
      createdAt: "2024-02-10T09:00:00.000Z",
      updatedAt: "2024-03-05T16:30:00.000Z",
      createdByRealtorId: USER_IDS.realtor,
      assignedNotaryId: USER_IDS.notary,
      leaseDocument: {
        fileName: "contrato-arrendamiento-los-alamos-234.pdf",
        uploadedAt: "2024-02-10T09:05:00.000Z",
        initialHash:
          "feedface0123456789abcdef0123456789abcdef0123456789abcdef012345678",
      },
      finalSignedDocument: {
        fileName: "contrato-arrendamiento-los-alamos-234-firmado.pdf",
        hash: postSignHash,
        generatedAt: "2024-02-22T15:00:00.000Z",
      },
      certifiedDocument: {
        fileName: "contrato-arrendamiento-los-alamos-234-certificado.pdf",
        hash: certifiedHash,
        certifiedAt: "2024-03-05T16:00:00.000Z",
      },
      property: {
        address: "Calle Los Álamos 234",
        district: "La Molina",
        province: "Lima",
        department: "Lima",
        reference: "Casa en urbanización Los Álamos",
        sunarpRecordPlaceholder: "Partida N° 16789012 — Zona Registral Lima",
        propertyAuthorityEvidence:
          "Partida registral SUNARP N° 16789012 — titularidad verificada con observación menor en linderos",
        normalizedAddressKey: "calle-los-alamos-234-la-molina",
      },
      leaseTerms: {
        monthlyRent: 2600,
        depositAmount: 2600,
        currency: "PEN",
        startDate: "2024-03-15",
        expirationDate: "2025-03-14",
        durationMonths: 12,
        useType: "residential",
      },
      signers: [
        completeSigner(
          "sig-006-landlord",
          "landlord",
          "Jorge Luis Vargas Castillo",
          "jorge.vargas@outlook.pe",
          "+51 976 543 210",
          "00321654",
          "tok-jorge-alamos-006",
          "2024-02-18T10:00:00.000Z",
          postSignHash,
          [
            audit("aud-006-j-1", id, USER_IDS.landlordJorge, "landlord", "link_opened", "Enlace de firma abierto", "2024-02-16T09:00:00.000Z"),
            audit("aud-006-j-2", id, USER_IDS.landlordJorge, "landlord", "otp_sent", "OTP enviado por WhatsApp", "2024-02-16T09:01:00.000Z"),
            audit("aud-006-j-3", id, USER_IDS.landlordJorge, "landlord", "otp_verified", "OTP verificado", "2024-02-16T09:03:00.000Z"),
            audit("aud-006-j-4", id, USER_IDS.landlordJorge, "landlord", "consent_accepted", "Consentimiento aceptado", "2024-02-16T09:08:00.000Z"),
            audit("aud-006-j-5", id, USER_IDS.landlordJorge, "landlord", "identity_uploaded", "Documentos de identidad cargados", "2024-02-16T09:15:00.000Z"),
            audit("aud-006-j-6", id, USER_IDS.landlordJorge, "landlord", "signature_applied", "Firma digital aplicada", "2024-02-18T10:00:00.000Z"),
          ],
        ),
        completeSigner(
          "sig-006-renter",
          "renter",
          "Ana Lucía Paredes Soto",
          "ana.paredes@hotmail.com",
          "+51 954 321 098",
          "00654321",
          "tok-ana-alamos-006",
          "2024-02-22T14:30:00.000Z",
          postSignHash,
          [
            audit("aud-006-a-1", id, USER_IDS.renterAna, "renter", "link_opened", "Enlace de firma abierto", "2024-02-20T11:00:00.000Z", "192.168.8.77", DEVICE_MOBILE),
            audit("aud-006-a-2", id, USER_IDS.renterAna, "renter", "otp_sent", "OTP enviado por WhatsApp", "2024-02-20T11:01:00.000Z", "192.168.8.77", DEVICE_MOBILE),
            audit("aud-006-a-3", id, USER_IDS.renterAna, "renter", "otp_verified", "OTP verificado", "2024-02-20T11:03:00.000Z", "192.168.8.77", DEVICE_MOBILE),
            audit("aud-006-a-4", id, USER_IDS.renterAna, "renter", "consent_accepted", "Consentimiento aceptado", "2024-02-20T11:08:00.000Z", "192.168.8.77", DEVICE_MOBILE),
            audit("aud-006-a-5", id, USER_IDS.renterAna, "renter", "identity_uploaded", "Documentos de identidad cargados", "2024-02-20T11:15:00.000Z", "192.168.8.77", DEVICE_MOBILE),
            audit("aud-006-a-6", id, USER_IDS.renterAna, "renter", "signature_applied", "Firma digital aplicada", "2024-02-22T14:30:00.000Z", "192.168.8.77", DEVICE_MOBILE),
          ],
        ),
      ],
      payment: {
        status: "paid",
        amount: 149,
        currency: "PEN",
        paidAt: "2024-02-10T09:30:00.000Z",
        paymentMethodPlaceholder: "Transferencia Interbank",
        invoiceStatus: "issued",
      },
      documentHashes: [
        {
          hash: "feedface0123456789abcdef0123456789abcdef0123456789abcdef012345678",
          stage: "initial_upload",
          algorithm: "SHA-256",
          timestamp: "2024-02-10T09:05:00.000Z",
          actorId: USER_IDS.realtor,
        },
        {
          hash: postSignHash,
          stage: "post_signatures",
          algorithm: "SHA-256",
          timestamp: "2024-02-22T15:00:00.000Z",
          actorId: "system",
        },
        {
          hash: certifiedHash,
          stage: "final_certified",
          algorithm: "SHA-256",
          timestamp: "2024-03-05T16:00:00.000Z",
          actorId: USER_IDS.notary,
        },
      ],
      registryCheck: { status: "registered", matchFound: false },
      notaryReview: {
        status: "complete",
        reviewStartedAt: "2024-02-28T09:00:00.000Z",
        reviewCompletedAt: "2024-03-05T16:00:00.000Z",
        reviewChecklist: NOTARY_CHECKLIST.map((item) => ({
          ...item,
          checked: true,
          checkedAt: "2024-03-05T14:00:00.000Z",
        })),
        decision: "certify_with_observations",
        observations:
          "Certificado con observación: la partida registral SUNARP N° 16789012 presenta una anotación pendiente de actualización en el lindero posterior. Se recomienda al arrendador regularizar ante SUNARP.",
        certificationTextPlaceholder:
          "Certifico el contrato con la observación indicada respecto al estado registral del inmueble.",
        certifiedAt: "2024-03-05T16:00:00.000Z",
      },
      auditEvents: [
        audit("aud-006-p-1", id, USER_IDS.realtor, "realtor", "packet_created", "Paquete creado", "2024-02-10T09:00:00.000Z"),
        audit("aud-006-p-2", id, "system", "system", "payment_confirmed", "Pago confirmado", "2024-02-10T09:30:00.000Z"),
        audit("aud-006-p-3", id, USER_IDS.realtor, "realtor", "send_to_signers", "Enlaces enviados a firmantes", "2024-02-14T08:00:00.000Z"),
        audit("aud-006-p-4", id, "system", "system", "all_signers_complete", "Todas las firmas completadas", "2024-02-22T15:00:00.000Z"),
        audit("aud-006-p-5", id, "system", "system", "evidence_report_generated", "Expediente de evidencia generado", "2024-02-23T10:00:00.000Z"),
        audit("aud-006-p-6", id, USER_IDS.realtor, "realtor", "submit_to_notary", "Enviado al notario", "2024-02-25T09:00:00.000Z"),
        audit("aud-006-p-7", id, USER_IDS.notary, "notary", "start_review", "Revisión notarial iniciada", "2024-02-28T09:00:00.000Z", "192.168.10.5"),
        audit("aud-006-p-8", id, USER_IDS.notary, "notary", "certify_with_observations", "Certificado con observaciones", "2024-03-05T16:00:00.000Z", "192.168.10.5"),
        audit("aud-006-p-9", id, "system", "system", "registry_entry_created", "Entrada de registro creada", "2024-03-05T16:30:00.000Z"),
      ],
      renewalEligibility: { eligible: true, availableAfter: "2025-02-15" },
    };
    packet.evidenceReport = buildEvidenceReport(
      packet,
      "2024-02-23T10:00:00.000Z",
      "submitted",
    );
    packet.evidenceReport.systemFlags = ["sunarp_observation"];
    packet.evidenceReport.summaryForNotary =
      "Expediente completo. Observación SUNARP: anotación pendiente en lindero posterior de partida N° 16789012.";
    return packet;
  })(),

  // PKT-2023-089 — certified, expired lease, registry still active (duplicate source)
  (() => {
    const id = "pkt-2023-089";
    const postSignHash =
      "089dead0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const certifiedHash =
      "089beef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const packet: LeasePacket = {
      id,
      packetCode: "PKT-2023-089",
      version: 1,
      status: "certified",
      createdAt: "2023-02-15T10:00:00.000Z",
      updatedAt: "2023-03-10T17:00:00.000Z",
      createdByRealtorId: USER_IDS.realtor,
      assignedNotaryId: USER_IDS.notary,
      leaseDocument: {
        fileName: "contrato-arrendamiento-las-flores-892-2023.pdf",
        uploadedAt: "2023-02-15T10:05:00.000Z",
        initialHash:
          "089abc0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      },
      finalSignedDocument: {
        fileName: "contrato-arrendamiento-las-flores-892-2023-firmado.pdf",
        hash: postSignHash,
        generatedAt: "2023-02-28T14:00:00.000Z",
      },
      certifiedDocument: {
        fileName: "contrato-arrendamiento-las-flores-892-2023-certificado.pdf",
        hash: certifiedHash,
        certifiedAt: "2023-03-10T16:30:00.000Z",
      },
      property: {
        address: "Calle Las Flores 892",
        district: "Barranco",
        province: "Lima",
        department: "Lima",
        reference: "Casa colonial restaurada, segundo piso",
        sunarpRecordPlaceholder: "Partida N° 13456789 — Zona Registral Lima",
        propertyAuthorityEvidence: "Escritura pública N° 8834-2016 — Notaría Salazar",
        normalizedAddressKey: "calle-las-flores-892-barranco",
      },
      leaseTerms: {
        monthlyRent: 2000,
        depositAmount: 2000,
        currency: "PEN",
        startDate: "2023-03-01",
        expirationDate: "2024-02-29",
        durationMonths: 12,
        useType: "residential",
      },
      signers: [
        completeSigner(
          "sig-089-landlord",
          "landlord",
          "Jorge Luis Vargas Castillo",
          "jorge.vargas@outlook.pe",
          "+51 976 543 210",
          "00321654",
          "tok-jorge-flores-089",
          "2023-02-22T11:00:00.000Z",
          postSignHash,
          [
            audit("aud-089-j-1", id, USER_IDS.landlordJorge, "landlord", "link_opened", "Enlace de firma abierto", "2023-02-20T09:00:00.000Z"),
            audit("aud-089-j-2", id, USER_IDS.landlordJorge, "landlord", "otp_sent", "OTP enviado por WhatsApp", "2023-02-20T09:01:00.000Z"),
            audit("aud-089-j-3", id, USER_IDS.landlordJorge, "landlord", "otp_verified", "OTP verificado", "2023-02-20T09:03:00.000Z"),
            audit("aud-089-j-4", id, USER_IDS.landlordJorge, "landlord", "consent_accepted", "Consentimiento aceptado", "2023-02-20T09:08:00.000Z"),
            audit("aud-089-j-5", id, USER_IDS.landlordJorge, "landlord", "identity_uploaded", "Documentos de identidad cargados", "2023-02-20T09:15:00.000Z"),
            audit("aud-089-j-6", id, USER_IDS.landlordJorge, "landlord", "signature_applied", "Firma digital aplicada", "2023-02-22T11:00:00.000Z"),
          ],
        ),
        completeSigner(
          "sig-089-renter",
          "renter",
          "Ana Lucía Paredes Soto",
          "ana.paredes@hotmail.com",
          "+51 954 321 098",
          "00654321",
          "tok-ana-flores-089",
          "2023-02-28T13:30:00.000Z",
          postSignHash,
          [
            audit("aud-089-a-1", id, USER_IDS.renterAna, "renter", "link_opened", "Enlace de firma abierto", "2023-02-25T14:00:00.000Z", "192.168.9.11", DEVICE_MOBILE),
            audit("aud-089-a-2", id, USER_IDS.renterAna, "renter", "otp_sent", "OTP enviado por WhatsApp", "2023-02-25T14:01:00.000Z", "192.168.9.11", DEVICE_MOBILE),
            audit("aud-089-a-3", id, USER_IDS.renterAna, "renter", "otp_verified", "OTP verificado", "2023-02-25T14:03:00.000Z", "192.168.9.11", DEVICE_MOBILE),
            audit("aud-089-a-4", id, USER_IDS.renterAna, "renter", "consent_accepted", "Consentimiento aceptado", "2023-02-25T14:08:00.000Z", "192.168.9.11", DEVICE_MOBILE),
            audit("aud-089-a-5", id, USER_IDS.renterAna, "renter", "identity_uploaded", "Documentos de identidad cargados", "2023-02-25T14:15:00.000Z", "192.168.9.11", DEVICE_MOBILE),
            audit("aud-089-a-6", id, USER_IDS.renterAna, "renter", "signature_applied", "Firma digital aplicada", "2023-02-28T13:30:00.000Z", "192.168.9.11", DEVICE_MOBILE),
          ],
        ),
      ],
      payment: {
        status: "paid",
        amount: 129,
        currency: "PEN",
        paidAt: "2023-02-15T10:30:00.000Z",
        paymentMethodPlaceholder: "Tarjeta Visa •••• 4242",
        invoiceStatus: "issued",
      },
      documentHashes: [
        {
          hash: "089abc0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
          stage: "initial_upload",
          algorithm: "SHA-256",
          timestamp: "2023-02-15T10:05:00.000Z",
          actorId: USER_IDS.realtor,
        },
        {
          hash: postSignHash,
          stage: "post_signatures",
          algorithm: "SHA-256",
          timestamp: "2023-02-28T14:00:00.000Z",
          actorId: "system",
        },
        {
          hash: certifiedHash,
          stage: "final_certified",
          algorithm: "SHA-256",
          timestamp: "2023-03-10T16:30:00.000Z",
          actorId: USER_IDS.notary,
        },
      ],
      registryCheck: { status: "registered", matchFound: false },
      notaryReview: {
        status: "complete",
        reviewStartedAt: "2023-03-05T09:00:00.000Z",
        reviewCompletedAt: "2023-03-10T16:30:00.000Z",
        reviewChecklist: NOTARY_CHECKLIST.map((item) => ({
          ...item,
          checked: true,
          checkedAt: "2023-03-10T15:00:00.000Z",
        })),
        decision: "certify",
        certificationTextPlaceholder:
          "Certifico que el presente contrato de arrendamiento ha sido suscrito mediante firmas digitales IOFE válidas.",
        certifiedAt: "2023-03-10T16:30:00.000Z",
      },
      auditEvents: [
        audit("aud-089-p-1", id, USER_IDS.realtor, "realtor", "packet_created", "Paquete creado", "2023-02-15T10:00:00.000Z"),
        audit("aud-089-p-2", id, "system", "system", "payment_confirmed", "Pago confirmado", "2023-02-15T10:30:00.000Z"),
        audit("aud-089-p-3", id, USER_IDS.realtor, "realtor", "send_to_signers", "Enlaces enviados a firmantes", "2023-02-18T08:00:00.000Z"),
        audit("aud-089-p-4", id, "system", "system", "all_signers_complete", "Todas las firmas completadas", "2023-02-28T14:00:00.000Z"),
        audit("aud-089-p-5", id, "system", "system", "evidence_report_generated", "Expediente de evidencia generado", "2023-03-01T10:00:00.000Z"),
        audit("aud-089-p-6", id, USER_IDS.realtor, "realtor", "submit_to_notary", "Enviado al notario", "2023-03-02T09:00:00.000Z"),
        audit("aud-089-p-7", id, USER_IDS.notary, "notary", "start_review", "Revisión notarial iniciada", "2023-03-05T09:00:00.000Z", "192.168.10.5"),
        audit("aud-089-p-8", id, USER_IDS.notary, "notary", "certify", "Contrato certificado", "2023-03-10T16:30:00.000Z", "192.168.10.5"),
        audit("aud-089-p-9", id, "system", "system", "registry_entry_created", "Entrada de registro creada", "2023-03-10T17:00:00.000Z"),
      ],
      renewalEligibility: { eligible: true, availableAfter: "2024-01-15" },
    };
    packet.evidenceReport = buildEvidenceReport(
      packet,
      "2023-03-01T10:00:00.000Z",
      "submitted",
    );
    return packet;
  })(),
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MOCK_REGISTRY: RegistryEntry[] = [
  {
    id: "reg-2024-004",
    propertyKey: "av-primavera-567-surco",
    packetId: "pkt-2024-004",
    propertyAddress: "Av. Primavera 567, Santiago de Surco, Lima",
    landlordNames: ["Jorge Luis Vargas Castillo"],
    renterNames: ["Ana Lucía Paredes Soto"],
    leaseStartDate: "2024-04-01",
    leaseExpirationDate: "2025-03-31",
    certificationStatus: "certified",
    active: true,
    createdAt: "2024-03-25T17:00:00.000Z",
  },
  {
    id: "reg-2024-006",
    propertyKey: "calle-los-alamos-234-la-molina",
    packetId: "pkt-2024-006",
    propertyAddress: "Calle Los Álamos 234, La Molina, Lima",
    landlordNames: ["Jorge Luis Vargas Castillo"],
    renterNames: ["Ana Lucía Paredes Soto"],
    leaseStartDate: "2024-03-15",
    leaseExpirationDate: "2025-03-14",
    certificationStatus: "certified_with_observations",
    active: true,
    createdAt: "2024-03-05T16:30:00.000Z",
  },
  {
    id: "reg-2023-089",
    propertyKey: "calle-las-flores-892-barranco",
    packetId: "pkt-2023-089",
    propertyAddress: "Calle Las Flores 892, Barranco, Lima",
    landlordNames: ["Jorge Luis Vargas Castillo"],
    renterNames: ["Ana Lucía Paredes Soto"],
    leaseStartDate: "2023-03-01",
    leaseExpirationDate: "2024-02-29",
    certificationStatus: "certified",
    active: true,
    createdAt: "2023-03-10T17:00:00.000Z",
  },
];
