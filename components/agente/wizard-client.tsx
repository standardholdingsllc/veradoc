"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
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
  processPaymentAction,
  completePayment3DSAction,
} from "@/lib/actions/payment-actions";
import { useCulqiCheckout } from "@/components/culqi/use-culqi-checkout";
import type { CheckoutConfig } from "@/components/culqi/use-culqi-checkout";
import { useCulqi3DS } from "@/components/culqi/use-culqi-3ds";
import type { ThreeDSParams } from "@/components/culqi/use-culqi-3ds";
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

const FEE_AMOUNT = 89;

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
  culqiPublicKey?: string;
  userEmail?: string;
  demoPaymentsEnabled?: boolean;
}

export function WizardClient({ coveredProvinces, culqiPublicKey, userEmail, demoPaymentsEnabled }: WizardClientProps) {
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

  const [preparedPayment, setPreparedPayment] = useState<{
    paymentId: string;
    amountCentimos: number;
    currency: string;
    description: string;
    challengeNonce: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "preparing" | "prepared" | "charging" | "challenging" | "completed" | "failed"
  >("idle");
  const [threeDSTokenId, setThreeDSTokenId] = useState<string | null>(null);
  const [threeDSChallengeNonce, setThreeDSChallengeNonce] = useState<string | null>(null);

  const { generateDevice, initAuthentication, reset: reset3DS } = useCulqi3DS({
    publicKey: culqiPublicKey ?? "",
    onResult: async (params: ThreeDSParams) => {
      if (!preparedPayment || !threeDSTokenId || !threeDSChallengeNonce) {
        toast.error("Estado 3DS inválido. Intente nuevamente.");
        setPaymentStatus("prepared");
        return;
      }
      setPaymentStatus("charging");
      try {
        const result = await completePayment3DSAction({
          paymentId: preparedPayment.paymentId,
          tokenId: threeDSTokenId,
          challengeNonce: threeDSChallengeNonce,
          authentication3DS: params,
        });
        if (result.error) {
          toast.error(result.error);
          setPaymentStatus("prepared");
          return;
        }
        if (result.data?.kind === "succeeded") {
          setPaymentStatus("completed");
          toast.success(TOAST.pagoConfirmado);
          setStep(6);
        } else if (result.data?.kind === "declined") {
          toast.error(result.data.message);
          setPaymentStatus("prepared");
        } else if (result.data?.kind === "uncertain") {
          toast.warning(result.data.message);
          setPaymentStatus("prepared");
        } else {
          toast.error(TOAST.errorGenerico);
          setPaymentStatus("prepared");
        }
      } catch {
        toast.error(TOAST.errorGenerico);
        setPaymentStatus("prepared");
      } finally {
        reset3DS();
        setThreeDSTokenId(null);
        setThreeDSChallengeNonce(null);
      }
    },
    onError: (message: string) => {
      toast.error(message);
      reset3DS();
      setThreeDSTokenId(null);
      setThreeDSChallengeNonce(null);
      setPaymentStatus("prepared");
    },
  });

  const { open: openCheckout } = useCulqiCheckout({
    onToken: async (tokenId: string) => {
      if (!preparedPayment || !userEmail) return;
      setPaymentStatus("charging");
      try {
        // Generate device fingerprint before processing (for antifraud)
        const deviceFingerPrintId = await generateDevice() ?? undefined;

        const result = await processPaymentAction({
          paymentId: preparedPayment.paymentId,
          tokenId,
          deviceFingerPrintId,
        });
        if (result.error) {
          toast.error(result.error);
          setPaymentStatus("prepared");
          return;
        }
        if (result.data?.kind === "succeeded") {
          setPaymentStatus("completed");
          toast.success(TOAST.pagoConfirmado);
          setStep(6);
        } else if (result.data?.kind === "declined") {
          toast.error(result.data.message);
          setPaymentStatus("prepared");
        } else if (result.data?.kind === "uncertain") {
          toast.warning(result.data.message);
          setPaymentStatus("prepared");
        } else if (result.data?.kind === "requires_3ds") {
          // Enter 3DS challenge flow
          setThreeDSTokenId(tokenId);
          setThreeDSChallengeNonce(result.data.challengeNonce);
          setPaymentStatus("challenging");
          toast.info("Se requiere autenticación 3DS. Procesando...");
          await initAuthentication(tokenId, preparedPayment.amountCentimos, userEmail);
        }
      } catch {
        toast.error(TOAST.errorGenerico);
        setPaymentStatus("prepared");
      }
    },
    onError: (message: string) => {
      toast.error(message);
      setPaymentStatus("prepared");
    },
  });

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

      const formData = new FormData();
      formData.append("file", file);

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
        return createdPacketId !== null;
      case 6:
        return true;
      default:
        return false;
    }
  }, [step, documentUploaded, contractForm, signers, createdPacketId, provinceHasCoverage]);

  const ensurePacketCreated = async (): Promise<string | null> => {
    if (createdPacketId) return createdPacketId;
    if (!uploadResult) return null;

    const packetResult = await createLeasePacket({
      packetId: uploadResult.packetId,
      storagePath: uploadResult.storagePath,
      fileHash: uploadResult.fileHash,
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

      // If Culqi is configured, use real checkout
      if (culqiPublicKey && userEmail) {
        const prepareResult = await preparePaymentAction(pId);
        if (prepareResult.error) {
          toast.error(prepareResult.error);
          setPaymentStatus("idle");
          return;
        }

        const prepared = prepareResult.data!;
        setPreparedPayment(prepared);
        setPaymentStatus("prepared");

        openCheckout({
          publicKey: culqiPublicKey,
          paymentId: prepared.paymentId,
          amountCentimos: prepared.amountCentimos,
          currency: prepared.currency,
          email: userEmail,
        });
      } else if (demoPaymentsEnabled) {
        // Demo mode: use legacy stub payment
        const paymentResult = await confirmPacketPayment(pId);
        if (paymentResult.error) {
          toast.error(paymentResult.error);
          setPaymentStatus("idle");
          return;
        }
        setPaymentStatus("completed");
        toast.success(TOAST.pagoConfirmado);
        setStep(6);
      } else {
        toast.error("Pagos no configurados. Contacte al administrador.");
        setPaymentStatus("idle");
      }
    } catch {
      toast.error(TOAST.errorGenerico);
      setPaymentStatus("idle");
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryPayment = () => {
    if (!preparedPayment || !culqiPublicKey || !userEmail) return;
    openCheckout({
      publicKey: culqiPublicKey,
      paymentId: preparedPayment.paymentId,
      amountCentimos: preparedPayment.amountCentimos,
      currency: preparedPayment.currency,
      email: userEmail,
    });
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
    void navigator.clipboard.writeText(`${window.location.origin}${url}`);
    toast.success(TOAST.copiadoPortapapeles);
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8">
      {culqiPublicKey && (
        <>
          <Script src="https://js.culqi.com/checkout-js" strategy="afterInteractive" />
          <Script src="https://3ds.culqi.com" strategy="afterInteractive" />
        </>
      )}
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
            <div className="rounded-md border border-border bg-surface/50 p-6 text-center">
              <p className="text-xs uppercase tracking-wide text-muted">
                {WIZARD.tarifaVeradoc}
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold text-primary">
                {preparedPayment
                  ? formatCurrency(preparedPayment.amountCentimos / 100)
                  : formatCurrency(FEE_AMOUNT)}
              </p>
            </div>

            <p className="text-sm text-muted">
              Al confirmar el pago se creará el paquete de arrendamiento y se
              bloqueará la versión del documento.
            </p>

            {paymentStatus === "completed" && (
              <div className="rounded-md border border-success/30 bg-success/5 p-4 text-center text-sm text-success">
                <Check className="mx-auto mb-2 size-5" />
                Pago confirmado exitosamente.
              </div>
            )}

            {(paymentStatus === "idle" || paymentStatus === "preparing") && (
              <Button
                className="w-full"
                size="lg"
                onClick={handlePayment}
                disabled={processing || paymentStatus === "preparing"}
              >
                {(processing || paymentStatus === "preparing") && <Loader2 className="size-4 animate-spin" />}
                {demoPaymentsEnabled && !culqiPublicKey ? "Simular pago" : ACTIONS.pagarYCrear}
              </Button>
            )}

            {paymentStatus === "prepared" && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleRetryPayment}
                disabled={processing}
              >
                Reintentar pago
              </Button>
            )}

            {paymentStatus === "charging" && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" />
                Procesando pago...
              </div>
            )}

            {paymentStatus === "challenging" && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" />
                Autenticación 3DS en progreso...
              </div>
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
