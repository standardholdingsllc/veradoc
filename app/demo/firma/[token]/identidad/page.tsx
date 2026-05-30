"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  CreditCard,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ERRORS,
  PAGE_TITLES,
  SIGNER,
  TOAST,
} from "@/lib/i18n/labels";
import {
  completeLiveness,
  uploadIdentity,
} from "@/lib/services/signer-service";
import { cn } from "@/lib/utils";

type UploadKey = "dniFront" | "dniBack" | "selfie";

type UploadState = "idle" | "uploading" | "done";

const UPLOAD_SECTIONS: {
  key: UploadKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "dniFront", label: "DNI — Frente", icon: CreditCard },
  { key: "dniBack", label: "DNI — Reverso", icon: CreditCard },
  { key: "selfie", label: "Selfie / prueba de vida", icon: Camera },
];

export default function SignerIdentidadPage() {
  const router = useRouter();
  const context = useSignerContext();
  const [uploads, setUploads] = useState<Record<UploadKey, UploadState>>({
    dniFront: "idle",
    dniBack: "idle",
    selfie: "idle",
  });
  const [loading, setLoading] = useState(false);

  const allUploaded = Object.values(uploads).every((state) => state === "done");

  const simulateUpload = useCallback((key: UploadKey) => {
    setUploads((prev) => {
      if (prev[key] !== "idle") {
        return prev;
      }
      return { ...prev, [key]: "uploading" };
    });

    window.setTimeout(() => {
      setUploads((prev) => ({ ...prev, [key]: "done" }));
    }, 800);
  }, []);

  if (!context) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted">{ERRORS.enlaceInvalido}</p>
        </CardContent>
      </Card>
    );
  }

  const { basePath, packet, signer } = context;

  function handleVerifyIdentity() {
    if (!allUploaded || loading) {
      return;
    }

    setLoading(true);
    try {
      if (signer.status === "consent_accepted") {
        uploadIdentity(signer.id, packet.id);
      }
      completeLiveness(signer.id, packet.id);
      toast.success(TOAST.identidadVerificada);
      router.push(`${basePath}/revision`);
    } catch {
      toast.error(TOAST.errorGenerico);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={4} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {PAGE_TITLES.verificacionIdentidad}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-muted">
            Suba fotos claras de su documento y una selfie para confirmar su
            identidad.
          </p>

          <div className="flex flex-col gap-4">
            {UPLOAD_SECTIONS.map(({ key, label, icon: Icon }) => {
              const state = uploads[key];

              return (
                <button
                  key={key}
                  type="button"
                  disabled={state !== "idle"}
                  onClick={() => simulateUpload(key)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-md border-2 border-dashed p-6 text-center transition-colors",
                    state === "idle" &&
                      "cursor-pointer border-border hover:border-secondary hover:bg-surface",
                    state === "uploading" && "border-secondary bg-secondary/5",
                    state === "done" && "border-success bg-success/5",
                  )}
                >
                  {state === "done" ? (
                    <>
                      <CheckCircle2
                        className="size-8 text-success"
                        aria-hidden
                      />
                      <span className="text-sm font-medium text-success">
                        Cargado exitosamente
                      </span>
                    </>
                  ) : state === "uploading" ? (
                    <>
                      <Loader2
                        className="size-8 animate-spin text-secondary"
                        aria-hidden
                      />
                      <span className="text-sm text-muted">Cargando…</span>
                    </>
                  ) : (
                    <>
                      <Icon className="size-8 text-muted" aria-hidden />
                      <span className="text-sm font-medium">{label}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <Upload className="size-3.5" aria-hidden />
                        Toque para cargar
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <ul className="flex flex-col gap-1 text-xs text-muted">
            <li>{SIGNER.subirDniFrente}</li>
            <li>{SIGNER.subirDniReverso}</li>
            <li>{SIGNER.subirSelfie}</li>
          </ul>

          <Button
            className="h-12 min-h-12 w-full text-base"
            size="lg"
            disabled={!allUploaded || loading}
            onClick={handleVerifyIdentity}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : null}
            Verificar identidad
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
