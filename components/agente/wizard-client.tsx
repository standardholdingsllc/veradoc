"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  uploadLeaseDocument,
  createLeasePacket,
  confirmPacketPayment,
  sendSigningLinksAction,
} from "@/lib/actions/agente-actions";
import {
  preparePaymentAction,
  previewPrivatePromoAction,
  type PromoPreviewResult,
} from "@/lib/actions/payment-actions";
import { lookupRucAction } from "@/lib/actions/ruc-lookup-actions";
import { PaymentMethodSelector } from "@/components/payment/payment-method-selector";
import { formatCurrency, formatDate, truncateHash } from "@/lib/formatters";
import {
  ACTIONS,
  DOCUMENT,
  FORMS,
  PAGE_TITLES,
  ROLES,
  TOAST,
  UI,
  WIZARD,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import {
  findCoveredProvince,
  normalizeCoverageText,
} from "@/lib/coverage/normalize";

const WIZARD_STEPS = [
  { number: 1, label: WIZARD.cargarContrato },
  { number: 2, label: WIZARD.datosContrato },
  { number: 3, label: WIZARD.agregarFirmantes },
  { number: 4, label: WIZARD.revisarPaquete },
  { number: 5, label: WIZARD.pago },
  { number: 6, label: WIZARD.enviarEnlaces },
] as const;

const DISTRICTS = [
  "Miraflores",
  "San Isidro",
  "Barranco",
  "Surco",
  "Jesús María",
  "La Molina",
] as const;

const COMMERCIAL_SERVICE_LABELS: Record<string, string> = {
  packet_processing: "Creación y procesamiento del paquete",
  identity_and_evidence: "Identidad y expediente de evidencia",
  firmeasy_signing: "Firmas electrónicas FirmEasy",
  routine_messages: "Mensajes operativos estándar",
  evidence_report: "Informe de evidencia",
  notary_processing_when_accepted: "Trámite notarial cuando sea aceptado",
  standard_corrections: "Correcciones estándar del flujo",
  cpe: "Comprobante de pago electrónico",
  standard_storage: "Almacenamiento durante la ventana de servicio",
  workflow_support: "Soporte estándar del flujo",
  additional_primary_documents: "Documentos principales adicionales",
  additional_notarial_acts: "Actos notariales adicionales",
  certified_copies: "Copias certificadas",
  translation_or_interpreter: "Traducción o intérprete",
  legalization_or_apostille: "Legalización o apostilla",
  public_registry_fees: "Tasas de registros públicos",
  physical_delivery: "Entrega física",
  extraordinary_verification: "Verificación extraordinaria",
};

function commercialServiceLabel(key: string): string {
  return COMMERCIAL_SERVICE_LABELS[key] ?? key.replaceAll("_", " ");
}

interface SignerFormEntry {
  localId: string;
  roleInLease: "landlord" | "renter";
  fullName: string;
  email: string;
  whatsapp: string;
  dni: string;
}

interface ContractForm {
  address: string;
  unit: string;
  district: string;
  province: string;
  department: string;
  monthlyRent: string;
  depositAmount: string;
  startDate: string;
  expirationDate: string;
  useType: "residential" | "commercial";
  notes: string;
}

function createSignerEntry(role: "landlord" | "renter"): SignerFormEntry {
  return {
    localId: `signer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roleInLease: role,
    fullName: "",
    email: "",
    whatsapp: "+51",
    dni: "",
  };
}

function computeDurationMonths(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(1, months);
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Pasos del asistente" className="mb-8">
      <ol className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((step) => {
          const isActive = step.number === currentStep;
          const isComplete = step.number < currentStep;
          return (
            <li
              key={step.number}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                isActive
                  ? "border-secondary bg-secondary/5 text-secondary"
                  : isComplete
                    ? "border-success/30 bg-success/5 text-success"
                    : "border-border bg-surface text-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold",
                  isActive
                    ? "bg-secondary text-white"
                    : isComplete
                      ? "bg-success text-white"
                      : "bg-border text-muted",
                )}
              >
                {isComplete ? <Check className="size-3" /> : step.number}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 font-mono text-xs text-muted">
        {WIZARD.paso} {currentStep} {WIZARD.de} {WIZARD_STEPS.length} ·{" "}
        {WIZARD_STEPS[currentStep - 1]?.label}
      </p>
    </nav>
  );
}

interface WizardClientProps {
  coveredProvinces: string[];
  feeAmount: number;
  serviceWindowDays: number;
  includedServices: string[];
  excludedServices: string[];
  demoPaymentsEnabled?: boolean;
  mercadoPagoPublicKey?: string;
  realtorEmail?: string;
}

export function WizardClient({
  coveredProvinces,
  feeAmount,
  serviceWindowDays,
  includedServices,
  excludedServices,
  demoPaymentsEnabled,
  mercadoPagoPublicKey,
  realtorEmail,
}: WizardClientProps) {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    storagePath: string;
    fileHash: string;
    packetId: string;
  } | null>(null);
  const [createdPacketId, setCreatedPacketId] = useState<string | null>(null);
  const [signingLinks, setSigningLinks] = useState<
    { name: string; role: string; url: string }[]
  >([]);
  const [processing, setProcessing] = useState(false);
  const [fileName, setFileName] = useState("");
  const uploadAttemptRef = useRef<{
    fingerprint: string;
    packetId: string;
  } | null>(null);

  const [contractForm, setContractForm] = useState<ContractForm>({
    address: "",
    unit: "",
    district: "Miraflores",
    province: "Lima",
    department: "Lima",
    monthlyRent: "",
    depositAmount: "",
    startDate: "",
    expirationDate: "",
    useType: "residential",
    notes: "",
  });

  const [signers, setSigners] = useState<SignerFormEntry[]>([
    createSignerEntry("landlord"),
    createSignerEntry("renter"),
  ]);

  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "preparing" | "completed"
  >("idle");

  const [preparedPayment, setPreparedPayment] = useState<{
    paymentId: string;
    amountCentimos: number;
    standardAmountCentimos: number;
    discountCentimos: number;
  } | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [promoPreview, setPromoPreview] = useState<PromoPreviewResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Purchaser / comprobante state
  const [comprobanteType, setComprobanteType] = useState<"01" | "03">("03");
  const [purchaserNumDoc, setPurchaserNumDoc] = useState("");
  const [purchaserRazonSocial, setPurchaserRazonSocial] = useState("");
  const [purchaserConfirmed, setPurchaserConfirmed] = useState(false);
  const [rucLookupLoading, setRucLookupLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (comprobanteType !== "01" || purchaserNumDoc.length !== 11) {
      queueMicrotask(() => {
        if (!cancelled) setRucLookupLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(async () => {
      if (cancelled) return;
      setRucLookupLoading(true);
      try {
        const result = await lookupRucAction(purchaserNumDoc);
        if (cancelled) return;
        if (result.data) {
          setPurchaserRazonSocial((current) =>
            current.trim() === "" ? result.data!.razonSocial : current,
          );
        }
      } finally {
        if (!cancelled) {
          setRucLookupLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [comprobanteType, purchaserNumDoc]);

  const mercadoPagoConfigured = !!mercadoPagoPublicKey;

  const coveredProvince = findCoveredProvince(
    contractForm.province,
    coveredProvinces,
  );
  const provinceHasCoverage = coveredProvince !== null;

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || uploading) return;

      setUploading(true);
      setUploadProgress(10);
      setFileName(file.name);

      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      if (uploadAttemptRef.current?.fingerprint !== fingerprint) {
        uploadAttemptRef.current = {
          fingerprint,
          packetId: crypto.randomUUID(),
        };
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("packetId", uploadAttemptRef.current.packetId);

      setUploadProgress(40);
      const result = await uploadLeaseDocument(formData);
      setUploadProgress(100);

      if (result.error) {
        toast.error(result.error);
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      setUploadResult(result.data!);
      setDocumentUploaded(true);
      setUploading(false);
    },
    [uploading],
  );

  const updateSigner = (
    localId: string,
    field: keyof SignerFormEntry,
    value: string,
  ) => {
    setSigners((prev) =>
      prev.map((signer) =>
        signer.localId === localId ? { ...signer, [field]: value } : signer,
      ),
    );
  };

  const addSigner = () => {
    setSigners((prev) => [...prev, createSignerEntry("renter")]);
  };

  const removeSigner = (localId: string) => {
    setSigners((prev) =>
      prev.length > 1 ? prev.filter((s) => s.localId !== localId) : prev,
    );
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return documentUploaded;
      case 2:
        return (
          contractForm.address.trim() !== "" &&
          contractForm.district !== "" &&
          contractForm.monthlyRent !== "" &&
          contractForm.startDate !== "" &&
          contractForm.expirationDate !== "" &&
          provinceHasCoverage
        );
      case 3:
        return signers.every(
          (s) =>
            s.fullName.trim() !== "" &&
            s.email.trim() !== "" &&
            s.dni.trim().length === 8,
        );
      case 4:
        return true;
      case 5:
        return createdPacketId !== null && purchaserConfirmed;
      case 6:
        return true;
      default:
        return false;
    }
  }, [step, documentUploaded, contractForm, signers, createdPacketId, provinceHasCoverage, purchaserConfirmed]);

  const ensurePacketCreated = async (): Promise<string | null> => {
    if (createdPacketId) return createdPacketId;
    if (!uploadResult) return null;

    const packetResult = await createLeasePacket({
      packetId: uploadResult.packetId,
      property: {
        address: contractForm.address,
        unit: contractForm.unit || undefined,
        district: contractForm.district,
        province: normalizeCoverageText(
          coveredProvince ?? contractForm.province,
        ),
        department: normalizeCoverageText(contractForm.department),
      },
      leaseTerms: {
        monthlyRent: Number(contractForm.monthlyRent),
        depositAmount: Number(contractForm.depositAmount) || 0,
        currency: "PEN" as const,
        startDate: contractForm.startDate,
        expirationDate: contractForm.expirationDate,
        durationMonths: computeDurationMonths(
          contractForm.startDate,
          contractForm.expirationDate,
        ),
        useType: contractForm.useType,
        notes: contractForm.notes || undefined,
      },
      signers: signers.map((s) => ({
        roleInLease: s.roleInLease,
        fullName: s.fullName,
        email: s.email,
        whatsapp: s.whatsapp,
        dni: s.dni,
      })),
    });

    if (packetResult.error) {
      toast.error(packetResult.error);
      return null;
    }

    const pId = packetResult.data!.packetId;
    setCreatedPacketId(pId);
    return pId;
  };

  const handlePayment = async () => {
    if (processing || !uploadResult) return;

    setProcessing(true);
    setPaymentStatus("preparing");
    try {
      const pId = await ensurePacketCreated();
      if (!pId) { setPaymentStatus("idle"); return; }

      if (demoPaymentsEnabled || mercadoPagoConfigured) {
        const prepareResult = await preparePaymentAction({
          packetId: pId,
          comprobanteType,
          purchaserTipoDoc: comprobanteType === "01" ? "6" : "1",
          purchaserNumDoc,
          purchaserRazonSocial: purchaserRazonSocial || undefined,
          promoCode: promoPreview ? promoCode : undefined,
        });
        if (prepareResult.error || !prepareResult.data) {
          toast.error(prepareResult.error ?? "No se pudo preparar el pago.");
          setPaymentStatus("idle");
          return;
        }

        if (demoPaymentsEnabled) {
          const paymentResult = await confirmPacketPayment(prepareResult.data.paymentId);
          if (paymentResult.error) {
            toast.error(paymentResult.error);
            setPaymentStatus("idle");
            return;
          }
          setPaymentStatus("completed");
          toast.success(TOAST.pagoConfirmado);
          setStep(6);
          return;
        }

        setPreparedPayment({
          paymentId: prepareResult.data.paymentId,
          amountCentimos: prepareResult.data.amountCentimos,
          standardAmountCentimos: prepareResult.data.standardAmountCentimos,
          discountCentimos: prepareResult.data.discountCentimos,
        });
        setPaymentStatus("idle");
      } else {
        toast.error("Proveedor de pago pendiente de integración.");
        setPaymentStatus("idle");
      }
    } catch {
      toast.error(TOAST.errorGenerico);
      setPaymentStatus("idle");
    } finally {
      setProcessing(false);
    }
  };

  const handleSendLinks = async () => {
    if (!createdPacketId || processing) return;

    setProcessing(true);
    try {
      const result = await sendSigningLinksAction(createdPacketId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSigningLinks(result.data!.links);
      toast.success(TOAST.enlacesEnviados);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  };

  const copyLink = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast.success(TOAST.copiadoPortapapeles);
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8">
      <header className="mb-6">
        <Link
          href="/agente"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {ACTIONS.volverAlPanel}
        </Link>
        <h1 className="text-xl font-semibold text-primary">
          {PAGE_TITLES.nuevoPaquete}
        </h1>
      </header>

      <StepIndicator currentStep={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{WIZARD.cargarContrato}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!documentUploaded ? (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border px-6 py-12",
                  uploading && "border-secondary bg-secondary/5",
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mb-4 size-10 animate-spin text-secondary" />
                    <p className="text-sm text-muted">{UI.cargando}</p>
                    <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full bg-secondary transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-xs text-muted">
                      {uploadProgress}%
                    </p>
                  </>
                ) : (
                  <>
                    <FileUp className="mb-4 size-10 text-muted" />
                    <p className="mb-1 text-sm font-medium">
                      {ACTIONS.subirContrato}
                    </p>
                    <p className="mb-4 text-xs text-muted">
                      PDF · máx. 50 MB
                    </p>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <span className="inline-flex items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
                        <Upload className="size-4" />
                        {ACTIONS.subirContrato}
                      </span>
                    </label>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-surface/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {DOCUMENT.nombreArchivo}: {fileName}
                    </p>
                  </div>
                  <Badge variant="success">
                    <Check className="size-3" />
                    Cargado
                  </Badge>
                </div>
                {uploadResult && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {DOCUMENT.hashInicial}:
                    </span>
                    <code className="rounded bg-background px-2 py-0.5 font-mono text-xs">
                      {truncateHash(uploadResult.fileHash)}
                    </code>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{WIZARD.datosContrato}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="col-span-2 space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.direccion}
                </span>
                <input
                  type="text"
                  value={contractForm.address}
                  onChange={(e) =>
                    setContractForm((f) => ({ ...f, address: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.unidad}
                </span>
                <input
                  type="text"
                  value={contractForm.unit}
                  onChange={(e) =>
                    setContractForm((f) => ({ ...f, unit: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.distrito}
                </span>
                <select
                  value={contractForm.district}
                  onChange={(e) =>
                    setContractForm((f) => ({ ...f, district: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.provincia}
                </span>
                <input
                  type="text"
                  value={contractForm.province}
                  onChange={(e) =>
                    setContractForm((f) => ({ ...f, province: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                {!provinceHasCoverage && contractForm.province && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-error">
                    <AlertTriangle className="size-3" />
                    Sin cobertura notarial en esta provincia
                  </p>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.departamento}
                </span>
                <input
                  type="text"
                  value={contractForm.department}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      department: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.rentaMensual}
                </span>
                <input
                  type="number"
                  value={contractForm.monthlyRent}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      monthlyRent: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.deposito}
                </span>
                <input
                  type="number"
                  value={contractForm.depositAmount}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      depositAmount: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.moneda}
                </span>
                <input
                  type="text"
                  value="PEN"
                  readOnly
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.fechaInicio}
                </span>
                <input
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.fechaVencimiento}
                </span>
                <input
                  type="date"
                  value={contractForm.expirationDate}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      expirationDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.tipoUso}
                </span>
                <select
                  value={contractForm.useType}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      useType: e.target.value as "residential" | "commercial",
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="residential">{FORMS.vivienda}</option>
                  <option value="commercial">{FORMS.comercial}</option>
                </select>
              </label>

              <label className="col-span-2 space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.notas}
                </span>
                <textarea
                  value={contractForm.notes}
                  onChange={(e) =>
                    setContractForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {signers.map((signer) => (
            <Card key={signer.localId}>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">
                  {signer.roleInLease === "landlord"
                    ? ROLES.landlord
                    : ROLES.renter}
                </CardTitle>
                {signers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSigner(signer.localId)}
                    aria-label={FORMS.eliminarFirmante}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="col-span-2 space-y-1">
                    <span className="text-xs font-medium text-muted">
                      {FORMS.nombreCompleto}
                    </span>
                    <input
                      type="text"
                      value={signer.fullName}
                      onChange={(e) =>
                        updateSigner(
                          signer.localId,
                          "fullName",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted">
                      {FORMS.correoElectronico}
                    </span>
                    <input
                      type="email"
                      value={signer.email}
                      onChange={(e) =>
                        updateSigner(signer.localId, "email", e.target.value)
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted">
                      {FORMS.whatsapp}
                    </span>
                    <input
                      type="tel"
                      value={signer.whatsapp}
                      onChange={(e) =>
                        updateSigner(
                          signer.localId,
                          "whatsapp",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted">
                      {FORMS.dni}
                    </span>
                    <input
                      type="text"
                      maxLength={8}
                      value={signer.dni}
                      onChange={(e) =>
                        updateSigner(
                          signer.localId,
                          "dni",
                          e.target.value.replace(/\D/g, ""),
                        )
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted">
                      {FORMS.rolEnContrato}
                    </span>
                    <select
                      value={signer.roleInLease}
                      onChange={(e) =>
                        updateSigner(
                          signer.localId,
                          "roleInLease",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="landlord">{ROLES.landlord}</option>
                      <option value="renter">{ROLES.renter}</option>
                    </select>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={addSigner}>
            <Plus className="size-4" />
            {FORMS.agregarFirmante}
          </Button>
        </div>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{WIZARD.resumenPaquete}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                {UI.propiedad}
              </h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">{FORMS.direccion}</dt>
                  <dd>{contractForm.address}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{FORMS.unidad}</dt>
                  <dd>{contractForm.unit || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{FORMS.distrito}</dt>
                  <dd>{contractForm.district}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{FORMS.rentaMensual}</dt>
                  <dd className="font-mono">
                    {formatCurrency(Number(contractForm.monthlyRent))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{FORMS.deposito}</dt>
                  <dd className="font-mono">
                    {formatCurrency(Number(contractForm.depositAmount) || 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{FORMS.tipoUso}</dt>
                  <dd>
                    {contractForm.useType === "residential"
                      ? FORMS.vivienda
                      : FORMS.comercial}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{FORMS.fechaInicio}</dt>
                  <dd>
                    {contractForm.startDate
                      ? formatDate(contractForm.startDate)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">
                    {FORMS.fechaVencimiento}
                  </dt>
                  <dd>
                    {contractForm.expirationDate
                      ? formatDate(contractForm.expirationDate)
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                {UI.firmantes} ({signers.length})
              </h3>
              <ul className="space-y-2">
                {signers.map((signer) => (
                  <li
                    key={signer.localId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{signer.fullName}</span>
                    <span className="font-mono text-xs text-muted">
                      {signer.roleInLease === "landlord"
                        ? ROLES.landlord
                        : ROLES.renter}{" "}
                      · DNI {signer.dni}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                {DOCUMENT.contratoArrendamiento}
              </h3>
              <p className="text-sm">{fileName}</p>
              {uploadResult && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted">
                    {DOCUMENT.hashInicial}:
                  </span>
                  <code className="rounded bg-surface px-2 py-0.5 font-mono text-xs">
                    {truncateHash(uploadResult.fileHash)}
                  </code>
                </div>
              )}
            </section>

            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{WIZARD.documentoBloqueado}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{WIZARD.pago}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!preparedPayment && (
              <>
                <div className="rounded-md border border-border bg-surface/50 p-6 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {WIZARD.tarifaVeradoc}
                  </p>
                  {promoPreview && (
                    <p className="mt-2 text-sm text-muted line-through">
                      {formatCurrency(promoPreview.standardAmountCentimos / 100)}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-3xl font-semibold text-primary">
                    {formatCurrency(
                      promoPreview ? promoPreview.amountCentimos / 100 : feeAmount,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">Precio final por documento, IGV incluido.</p>
                  {promoPreview && (
                    <p className="mt-2 text-sm font-medium text-success">
                      Promoción {promoPreview.codeHint}: ahorro de{" "}
                      {formatCurrency(promoPreview.discountCentimos / 100)}
                    </p>
                  )}
                </div>

                <section className="space-y-3 rounded-md border border-border p-4">
                  <h3 className="text-sm font-medium">Código promocional privado</h3>
                  <p className="text-xs text-muted">
                    VeraDoc no mantiene saldos ni créditos. Los códigos se validan caso por caso.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(event) => {
                        setPromoCode(event.target.value);
                        setPromoPreview(null);
                      }}
                      maxLength={64}
                      placeholder="Código promocional"
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={promoLoading || !promoCode.trim()}
                      onClick={async () => {
                        setPromoLoading(true);
                        const result = await previewPrivatePromoAction(promoCode);
                        setPromoLoading(false);
                        if (result.error || !result.data) {
                          setPromoPreview(null);
                          toast.error(result.error ?? "Código promocional inválido.");
                          return;
                        }
                        setPromoPreview(result.data);
                        toast.success("Código promocional aplicado.");
                      }}
                    >
                      {promoLoading && <Loader2 className="size-4 animate-spin" />}
                      Aplicar
                    </Button>
                  </div>
                </section>

                <section className="space-y-3 rounded-md border border-border p-4 text-sm">
                  <h3 className="font-medium">Qué incluye</h3>
                  <ul className="grid gap-1 text-muted sm:grid-cols-2">
                    {includedServices.map((service) => (
                      <li key={service}>• {commercialServiceLabel(service)}</li>
                    ))}
                  </ul>
                  {excludedServices.length > 0 && (
                    <details className="text-xs text-muted">
                      <summary className="cursor-pointer font-medium text-foreground">
                        Servicios y gastos no incluidos
                      </summary>
                      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                        {excludedServices.map((service) => (
                          <li key={service}>• {commercialServiceLabel(service)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <p className="border-t border-border pt-3 text-xs text-muted">
                    El pago activa una ventana de servicio de {serviceWindowDays} días. La tarifa se
                    devenga cuando la transacción se confirma y no depende del resultado notarial.
                    Los reembolsos no se ofrecen de forma rutinaria; solo proceden por errores de cobro,
                    fallas atribuibles a VeraDoc o una obligación legal.
                  </p>
                </section>

                {/* Comprobante type and purchaser data capture */}
                <section className="space-y-4 rounded-md border border-border p-4">
                  <h3 className="text-sm font-medium">Datos de facturación</h3>

                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="comprobanteType"
                        value="03"
                        checked={comprobanteType === "03"}
                        onChange={() => {
                          setComprobanteType("03");
                          setPurchaserConfirmed(false);
                          setPurchaserNumDoc("");
                          setPurchaserRazonSocial("");
                        }}
                        className="accent-primary"
                      />
                      <span className="text-sm">Boleta de venta</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="comprobanteType"
                        value="01"
                        checked={comprobanteType === "01"}
                        onChange={() => {
                          setComprobanteType("01");
                          setPurchaserConfirmed(false);
                          setPurchaserNumDoc("");
                          setPurchaserRazonSocial("");
                        }}
                        className="accent-primary"
                      />
                      <span className="text-sm">Factura</span>
                    </label>
                  </div>

                  {comprobanteType === "03" && (
                    <>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted">DNI (8 dígitos)</span>
                        <input
                          type="text"
                          maxLength={8}
                          value={purchaserNumDoc}
                          onChange={(e) => {
                            setPurchaserNumDoc(e.target.value.replace(/\D/g, ""));
                            setPurchaserConfirmed(false);
                          }}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
                          placeholder="12345678"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted">Nombre completo del comprador</span>
                        <input
                          type="text"
                          value={purchaserRazonSocial}
                          onChange={(e) => {
                            setPurchaserRazonSocial(e.target.value);
                            setPurchaserConfirmed(false);
                          }}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          placeholder="JUAN PÉREZ GARCÍA"
                        />
                      </label>
                    </>
                  )}

                  {comprobanteType === "01" && (
                    <>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted">RUC (11 dígitos)</span>
                        <input
                          type="text"
                          maxLength={11}
                          value={purchaserNumDoc}
                          onChange={(e) => {
                            setPurchaserNumDoc(e.target.value.replace(/\D/g, ""));
                            setPurchaserConfirmed(false);
                          }}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
                          placeholder="20123456789"
                        />
                        {rucLookupLoading && (
                          <span className="text-xs text-muted">Consultando SUNAT...</span>
                        )}
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted">Razón social</span>
                        <input
                          type="text"
                          value={purchaserRazonSocial}
                          onChange={(e) => {
                            setPurchaserRazonSocial(e.target.value);
                            setPurchaserConfirmed(false);
                          }}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          placeholder="EMPRESA S.A.C."
                        />
                      </label>
                    </>
                  )}

                  {/* Confirmation */}
                  {((comprobanteType === "03" && purchaserNumDoc.length === 8) ||
                    (comprobanteType === "01" && purchaserNumDoc.length === 11 && purchaserRazonSocial.trim())) && (
                    <div className="space-y-3">
                      <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                        <p className="flex items-center gap-1 font-medium">
                          <AlertTriangle className="size-3 shrink-0" />
                          Verificar datos antes de continuar
                        </p>
                        <p className="mt-1">
                          {comprobanteType === "01"
                            ? `Se emitirá una factura a nombre de ${purchaserRazonSocial.trim().toUpperCase()} (RUC ${purchaserNumDoc}). El RUC y razón social deben coincidir exactamente con los registrados en SUNAT.`
                            : `Se emitirá una boleta de venta para DNI ${purchaserNumDoc}.`}
                        </p>
                        <p className="mt-1">Una vez emitido el comprobante, no se puede modificar.</p>
                      </div>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={purchaserConfirmed}
                          onChange={(e) => setPurchaserConfirmed(e.target.checked)}
                          className="mt-0.5 accent-primary"
                        />
                        <span className="text-xs text-muted">
                          Confirmo que los datos de facturación son correctos y
                          entiendo que el comprobante no se puede modificar después de emitido.
                        </span>
                      </label>
                    </div>
                  )}
                </section>

                <p className="text-sm text-muted">
                  Al confirmar el pago se creará el paquete de arrendamiento y se
                  bloqueará la versión del documento.
                </p>
              </>
            )}

            {paymentStatus === "completed" && (
              <div className="rounded-md border border-success/30 bg-success/5 p-4 text-center text-sm text-success">
                <Check className="mx-auto mb-2 size-5" />
                Pago confirmado exitosamente.
              </div>
            )}

            {preparedPayment && paymentStatus !== "completed" && mercadoPagoPublicKey && (
              <PaymentMethodSelector
                publicKey={mercadoPagoPublicKey}
                paymentId={preparedPayment.paymentId}
                amountCentimos={preparedPayment.amountCentimos}
                payerEmail={realtorEmail}
                onCompleted={() => {
                  setPaymentStatus("completed");
                  toast.success(TOAST.pagoConfirmado);
                  setStep(6);
                }}
                onRetryPrepare={async () => {
                  const pId = createdPacketId;
                  if (!pId) return null;
                  const r = await preparePaymentAction({
                    packetId: pId,
                    comprobanteType,
                    purchaserTipoDoc: comprobanteType === "01" ? "6" : "1",
                    purchaserNumDoc,
                    purchaserRazonSocial: purchaserRazonSocial || undefined,
                    promoCode: promoPreview ? promoCode : undefined,
                  });
                  if (r.error || !r.data) {
                    toast.error(r.error ?? "Error preparando nuevo intento de pago.");
                    return null;
                  }
                  setPreparedPayment({
                    paymentId: r.data.paymentId,
                    amountCentimos: r.data.amountCentimos,
                    standardAmountCentimos: r.data.standardAmountCentimos,
                    discountCentimos: r.data.discountCentimos,
                  });
                  return { paymentId: r.data.paymentId, existingStatus: r.data.existingStatus };
                }}
              />
            )}

            {!preparedPayment && (paymentStatus === "idle" || paymentStatus === "preparing") && (
              <Button
                className="w-full"
                size="lg"
                onClick={handlePayment}
                disabled={processing || paymentStatus === "preparing" || !purchaserConfirmed}
              >
                {(processing || paymentStatus === "preparing") && <Loader2 className="size-4 animate-spin" />}
                {demoPaymentsEnabled ? "Simular pago" : mercadoPagoConfigured ? ACTIONS.pagarYCrear : ACTIONS.pagarYCrear}
              </Button>
            )}

          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{WIZARD.enviarEnlaces}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {signingLinks.map((link) => (
              <div
                key={link.url}
                className="rounded-md border border-border p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{link.name}</p>
                    <p className="text-xs text-muted">{link.role}</p>
                  </div>
                  <Badge variant="info">{DOCUMENT.enlaceSeguro}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-xs">
                    {link.url}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(link.url)}
                  >
                    <Copy className="size-4" />
                    {ACTIONS.copiarEnlace}
                  </Button>
                </div>
              </div>
            ))}

            {signingLinks.length === 0 && (
              <Button
                className="w-full"
                onClick={handleSendLinks}
                disabled={processing || !createdPacketId}
              >
                {processing && <Loader2 className="size-4 animate-spin" />}
                {ACTIONS.enviarEnlaces}
              </Button>
            )}

            {createdPacketId && (
              <div className="pt-2 text-center">
                <Link
                  href={`/agente/paquetes/${createdPacketId}`}
                  className="text-sm text-secondary hover:underline"
                >
                  {UI.verDetalle}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <footer className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || step === 6}
        >
          <ArrowLeft className="size-4" />
          {UI.anterior}
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep((s) => Math.min(6, s + 1))}
            disabled={!canProceed}
          >
            {UI.siguiente}
            <ArrowRight className="size-4" />
          </Button>
        ) : step === 5 && createdPacketId ? (
          <Link href={`/agente/paquetes/${createdPacketId}`}>
            <Button>
              {UI.verDetalle}
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        ) : null}
      </footer>
    </div>
  );
}
