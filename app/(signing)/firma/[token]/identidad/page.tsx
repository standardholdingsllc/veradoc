"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { hasPassedStep } from "@/lib/domain/production-signer-machine";
import { uploadIdentityDocument, completeIdentityUpload } from "@/lib/actions/signing";

type DocType = "dni_front" | "dni_back" | "selfie";

interface UploadSlot {
  type: DocType;
  label: string;
  description: string;
  accept: string;
  capture?: string;
}

const UPLOAD_SLOTS: UploadSlot[] = [
  {
    type: "dni_front",
    label: "DNI — Anverso",
    description: "Foto clara del frente de su DNI",
    accept: "image/jpeg,image/png,image/webp",
  },
  {
    type: "dni_back",
    label: "DNI — Reverso",
    description: "Foto clara del reverso de su DNI",
    accept: "image/jpeg,image/png,image/webp",
  },
  {
    type: "selfie",
    label: "Selfie de verificación",
    description: "Tome una foto de su rostro para verificar su identidad",
    accept: "image/jpeg,image/png,image/webp",
    capture: "user",
  },
];

export default function IdentityUploadPage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [uploaded, setUploaded] = useState<Record<DocType, boolean>>({
    dni_front: false,
    dni_back: false,
    selfie: false,
  });
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [completing, setCompleting] = useState(false);
  const [previews, setPreviews] = useState<Record<DocType, string | null>>({
    dni_front: null,
    dni_back: null,
    selfie: null,
  });

  useEffect(() => {
    if (hasPassedStep(ctx.signerStatus, 4)) {
      router.replace(`/firma/${ctx.token}/revision`);
    }
  }, [ctx.signerStatus, ctx.token, router]);

  const allUploaded = uploaded.dni_front && uploaded.dni_back && uploaded.selfie;

  async function handleFileChange(docType: DocType, file: File | null) {
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPreviews((p) => ({ ...p, [docType]: previewUrl }));

    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadIdentityDocument(ctx.signerId, formData, docType);
      if (result.error) {
        toast.error(result.error);
        setPreviews((p) => ({ ...p, [docType]: null }));
      } else {
        setUploaded((u) => ({ ...u, [docType]: true }));
        toast.success(`${docType === "selfie" ? "Selfie" : "DNI"} subido correctamente`);
      }
    } catch {
      toast.error("Error al subir archivo.");
      setPreviews((p) => ({ ...p, [docType]: null }));
    } finally {
      setUploading(null);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const result = await completeIdentityUpload(ctx.token);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Identidad verificada");
        router.push(`/firma/${ctx.token}/revision`);
      }
    } catch {
      toast.error("Error al completar verificación.");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <>
      <ProductionStepProgress currentStep={4} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Camera className="size-5 text-secondary" />
            <CardTitle>Verificación de identidad</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Suba las fotos de su DNI y una selfie para verificar su identidad.
          </p>

          {UPLOAD_SLOTS.map((slot) => (
            <UploadSection
              key={slot.type}
              slot={slot}
              isUploaded={uploaded[slot.type]}
              isUploading={uploading === slot.type}
              preview={previews[slot.type]}
              onFileChange={(file) => handleFileChange(slot.type, file)}
            />
          ))}

          <Button
            className="w-full"
            onClick={handleComplete}
            disabled={!allUploaded || completing}
          >
            {completing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 size-4" />
            )}
            Continuar
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function UploadSection({
  slot,
  isUploaded,
  isUploading,
  preview,
  onFileChange,
}: {
  slot: UploadSlot;
  isUploaded: boolean;
  isUploading: boolean;
  preview: string | null;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium">{slot.label}</p>
          <p className="text-xs text-muted-foreground">{slot.description}</p>
        </div>
        {isUploaded && (
          <CheckCircle2 className="size-5 text-success shrink-0" />
        )}
      </div>

      {preview ? (
        <div className="relative mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={slot.label}
            className="h-32 w-full rounded-md object-cover"
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70">
              <Loader2 className="size-6 animate-spin text-secondary" />
            </div>
          )}
        </div>
      ) : null}

      {!isUploaded && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={slot.accept}
            capture={slot.capture as "user" | "environment" | undefined}
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {slot.capture ? "Tomar foto" : "Seleccionar archivo"}
          </Button>
        </>
      )}
    </div>
  );
}
