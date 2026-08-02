"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { hasPassedStep } from "@/lib/domain/production-signer-machine";
import { getSignedDocumentUrl, recordLeaseReviewAction } from "@/lib/actions/signing";

const PdfViewerWithFetch = dynamic(
  () => import("@/components/pdf/pdf-viewer").then((m) => m.PdfViewerWithFetch),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface/30 h-[450px]">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    ),
  },
);

export default function LeaseReviewPage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Status stays at identity_verified through review; redirect if already signed
    if (
      ctx.signerStatus === "signed" ||
      ctx.signerStatus === "complete"
    ) {
      router.replace(`/firma/${ctx.token}/completado`);
    }
  }, [ctx.signerStatus, ctx.token, router]);

  async function handleContinue() {
    if (!reviewed) return;
    setSubmitting(true);
    try {
      const result = await recordLeaseReviewAction(ctx.token);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.push(`/firma/${ctx.token}/firmar`);
      }
    } catch {
      toast.error("Error al registrar revisión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProductionStepProgress currentStep={5} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-secondary" />
            <CardTitle>Revisión del contrato</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Revise el contrato de arrendamiento completo antes de proceder a la
            firma digital.
          </p>

          <PdfViewerWithFetch
            packetId={ctx.packetId}
            documentType="lease_original"
            fetchAction={getSignedDocumentUrl}
            height="h-[450px]"
          />

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border accent-secondary"
            />
            <span className="text-sm">
              He revisado el contrato de arrendamiento completo y estoy de
              acuerdo con su contenido.
            </span>
          </label>

          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={!reviewed || submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 size-4" />
            )}
            Proceder a la firma
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
