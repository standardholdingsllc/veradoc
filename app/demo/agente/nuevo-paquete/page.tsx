"use client";

import { useCallback, useMemo, useState } from "react";
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
import type { CreateSignerInput } from "@/lib/services/packet-service";
import {
  confirmPayment,
  createPacket,
  sendSigningLinks,
} from "@/lib/services/packet-service";
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
const DEMO_FILE_NAME = "contrato-arrendamiento-2024.pdf";
const DEMO_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

interface SignerFormEntry extends CreateSignerInput {
  localId: string;
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

function normalizeAddressKey(
  address: string,
  unit: string,
  district: string,
): string {
  const parts = [address, unit, district]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return parts;
}

function computeDurationMonths(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(1, months);
}

function createSignerEntry(
  role: "landlord" | "renter",
  defaults?: Partial<CreateSignerInput>,
): SignerFormEntry {
  return {
    localId: `signer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roleInLease: role,
    fullName: defaults?.fullName ?? "",
    email: defaults?.email ?? "",
    whatsapp: defaults?.whatsapp ?? "+51",
    dni: defaults?.dni ?? "",
  };
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

export default function NuevoPaquetePage() {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [createdPacketId, setCreatedPacketId] = useState<string | null>(null);
  const [signingLinks, setSigningLinks] = useState<
    { name: string; role: string; url: string }[]
  >([]);
  const [processing, setProcessing] = useState(false);

  const [contractForm, setContractForm] = useState<ContractForm>({
    address: "Av. Larco 345",
    unit: "Dept. 4B",
    district: "Miraflores",
    province: "Lima",
    department: "Lima",
    monthlyRent: "2800",
    depositAmount: "5600",
    startDate: "2024-06-01",
    expirationDate: "2026-05-31",
    useType: "residential",
    notes: "Contrato de arrendamiento — renovación anual",
  });

  const [signers, setSigners] = useState<SignerFormEntry[]>([
    createSignerEntry("landlord", {
      fullName: "María Elena Vargas Torres",
      email: "maria.vargas@email.com",
      whatsapp: "+51987654321",
      dni: "00456789",
    }),
    createSignerEntry("renter", {
      fullName: "Carlos Alberto Mendoza Ruiz",
      email: "carlos.mendoza@email.com",
      whatsapp: "+51912345678",
      dni: "00876543",
    }),
  ]);

  const handleSimulatedUpload = useCallback(() => {
    if (documentUploaded || uploading) {
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          setDocumentUploaded(true);
          return 100;
        }
        return prev + 20;
      });
    }, 200);
  }, [documentUploaded, uploading]);

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
          contractForm.expirationDate !== ""
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
  }, [step, documentUploaded, contractForm, signers, createdPacketId]);

  const handlePayment = async () => {
    if (processing) {
      return;
    }

    setProcessing(true);
    try {
      const now = new Date().toISOString();
      const packet = createPacket({
        property: {
          address: contractForm.address,
          unit: contractForm.unit || undefined,
          district: contractForm.district,
          province: contractForm.province,
          department: contractForm.department,
          normalizedAddressKey: normalizeAddressKey(
            contractForm.address,
            contractForm.unit,
            contractForm.district,
          ),
        },
        leaseTerms: {
          monthlyRent: Number(contractForm.monthlyRent),
          depositAmount: Number(contractForm.depositAmount),
          currency: "PEN",
          startDate: contractForm.startDate,
          expirationDate: contractForm.expirationDate,
          durationMonths: computeDurationMonths(
            contractForm.startDate,
            contractForm.expirationDate,
          ),
          useType: contractForm.useType,
          notes: contractForm.notes || undefined,
        },
        leaseDocument: {
          fileName: DEMO_FILE_NAME,
          uploadedAt: now,
          initialHash: DEMO_HASH,
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        signers: signers.map(({ localId: _localId, ...signer }) => signer),
        paymentAmount: FEE_AMOUNT,
      });

      confirmPayment(packet.id);
      setCreatedPacketId(packet.id);
      setSigningLinks(
        packet.signers.map((signer) => ({
          name: signer.fullName,
          role:
            signer.roleInLease === "landlord"
              ? ROLES.landlord
              : ROLES.renter,
          url: `/demo/firma/${signer.secureLinkToken}`,
        })),
      );
      toast.success(TOAST.pagoConfirmado);
      setStep(6);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendLinks = () => {
    if (!createdPacketId || processing) {
      return;
    }

    setProcessing(true);
    try {
      const updated = sendSigningLinks(createdPacketId);
      setSigningLinks(
        updated.signers.map((signer) => ({
          name: signer.fullName,
          role:
            signer.roleInLease === "landlord"
              ? ROLES.landlord
              : ROLES.renter,
          url: `/demo/firma/${signer.secureLinkToken}`,
        })),
      );
      toast.success(TOAST.enlacesEnviados);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  };

  const copyLink = (url: string) => {
    void navigator.clipboard.writeText(
      `${window.location.origin}${url}`,
    );
    toast.success(TOAST.copiadoPortapapeles);
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8">
      <header className="mb-6">
        <Link
          href="/demo/agente"
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

      {step === 1 ? (
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
                      PDF · máx. 10 MB (simulado)
                    </p>
                    <Button onClick={handleSimulatedUpload}>
                      <Upload className="size-4" />
                      {ACTIONS.subirContrato}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-surface/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{DEMO_FILE_NAME}</p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {DOCUMENT.nombreArchivo}: {DEMO_FILE_NAME}
                    </p>
                  </div>
                  <Badge variant="success">
                    <Check className="size-3" />
                    Cargado
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted">{DOCUMENT.hashInicial}:</span>
                  <code className="rounded bg-background px-2 py-0.5 font-mono text-xs">
                    {truncateHash(DEMO_HASH)}
                  </code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
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
                  readOnly
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted">
                  {FORMS.departamento}
                </span>
                <input
                  type="text"
                  value={contractForm.department}
                  readOnly
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
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
                    setContractForm((f) => ({ ...f, startDate: e.target.value }))
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
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          {signers.map((signer) => (
            <Card key={signer.localId}>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">
                  {signer.roleInLease === "landlord"
                    ? ROLES.landlord
                    : ROLES.renter}
                </CardTitle>
                {signers.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSigner(signer.localId)}
                    aria-label={FORMS.eliminarFirmante}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
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
                        updateSigner(signer.localId, "fullName", e.target.value)
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
                        updateSigner(signer.localId, "whatsapp", e.target.value)
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
      ) : null}

      {step === 4 ? (
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
                    {formatCurrency(Number(contractForm.depositAmount))}
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
                  <dd>{formatDate(contractForm.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">
                    {FORMS.fechaVencimiento}
                  </dt>
                  <dd>{formatDate(contractForm.expirationDate)}</dd>
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
              <p className="text-sm">{DEMO_FILE_NAME}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted">{DOCUMENT.hashInicial}:</span>
                <code className="rounded bg-surface px-2 py-0.5 font-mono text-xs">
                  {truncateHash(DEMO_HASH)}
                </code>
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{WIZARD.documentoBloqueado}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 5 ? (
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
                {formatCurrency(FEE_AMOUNT)}
              </p>
            </div>

            <p className="text-sm text-muted">
              Al confirmar el pago se creará el paquete de arrendamiento y se
              bloqueará la versión del documento.
            </p>

            <Button
              className="w-full"
              size="lg"
              onClick={handlePayment}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {ACTIONS.pagarYCrear}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 6 ? (
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

            <Button
              className="w-full"
              onClick={handleSendLinks}
              disabled={processing || !createdPacketId}
            >
              {processing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {ACTIONS.enviarEnlaces}
            </Button>

            {createdPacketId ? (
              <div className="pt-2 text-center">
                <Link
                  href={`/demo/agente/paquetes/${createdPacketId}`}
                  className="text-sm text-secondary hover:underline"
                >
                  {UI.verDetalle}
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
          <Link href={`/demo/agente/paquetes/${createdPacketId}`}>
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
