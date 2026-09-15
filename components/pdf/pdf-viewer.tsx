"use client";

import { useCallback, useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useContainerWidth } from "./use-container-width";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// ---------------------------------------------------------------------------
// PdfViewer — base component (requires a resolved URL)
// ---------------------------------------------------------------------------

interface PdfViewerProps {
  url: string;
  className?: string;
  height?: string;
  showToolbar?: boolean;
  initialPage?: number;
  downloadUrl?: string;
}

export function PdfViewer({
  url,
  className,
  height = "h-[500px]",
  showToolbar = true,
  initialPage = 1,
  downloadUrl,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { ref: containerRef, width: containerWidth } = useContainerWidth();

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setCurrentPage(initialPage);
      setError(null);
    },
    [initialPage],
  );

  const onDocumentLoadError = useCallback(() => {
    setError("No se pudo mostrar el documento en el navegador.");
  }, []);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(numPages, prev + 1));
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(3, +(prev + 0.25).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  }, []);

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface/30 p-8",
          height,
          className,
        )}
      >
        <FileText className="size-10 text-muted" />
        <p className="text-center text-sm text-muted">{error}</p>
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface/50"
          >
            <Download className="size-4" />
            Descargar PDF
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {showToolbar && numPages > 0 && (
        <div className="flex items-center justify-between gap-1 rounded-md border border-border bg-surface/30 px-2 py-1.5">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
              className="size-9 p-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[56px] text-center text-xs tabular-nums">
              {currentPage} / {numPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              aria-label="Página siguiente"
              className="size-9 p-0"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              aria-label="Reducir"
              className="size-9 p-0"
            >
              <ZoomOut className="size-4" />
            </Button>
            <span className="min-w-[40px] text-center text-xs tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 3}
              aria-label="Ampliar"
              className="size-9 p-0"
            >
              <ZoomIn className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          "overflow-auto rounded-md border border-border bg-surface/30",
          height,
        )}
      >
        {containerWidth > 0 && (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex h-full items-center justify-center p-12">
                <Loader2 className="size-6 animate-spin text-muted" />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              width={containerWidth * scale}
              className="mx-auto"
              renderTextLayer
              renderAnnotationLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PdfViewerWithFetch — resolves a signed URL then renders PdfViewer
// ---------------------------------------------------------------------------

type FetchResult =
  | { url?: string; error?: string }
  | { data?: { url: string }; error?: string };

interface PdfViewerWithFetchProps {
  packetId: string;
  documentType?: string;
  fetchAction: (
    packetId: string,
    documentType: string,
  ) => Promise<FetchResult>;
  className?: string;
  height?: string;
}

function extractUrl(result: FetchResult): string | null {
  if ("url" in result && result.url) return result.url;
  if ("data" in result && result.data?.url) return result.data.url;
  return null;
}

function extractError(result: FetchResult): string | null {
  return result.error ?? null;
}

export function PdfViewerWithFetch({
  packetId,
  documentType = "lease_original",
  fetchAction,
  className,
  height,
}: PdfViewerWithFetchProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAction(packetId, documentType);
      const resolved = extractUrl(result);
      if (resolved) {
        setUrl(resolved);
      } else {
        setError(extractError(result) ?? "Documento no disponible.");
      }
    } catch {
      setError("Error al cargar el documento.");
    } finally {
      setLoading(false);
    }
  }, [packetId, documentType, fetchAction]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-border bg-surface/30",
          height ?? "h-[500px]",
          className,
        )}
      >
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface/30 p-8",
          height ?? "h-[500px]",
          className,
        )}
      >
        <FileText className="size-10 text-muted" />
        <p className="text-center text-sm text-muted">
          {error ?? "Documento no disponible."}
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 size-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <PdfViewer
      url={url}
      downloadUrl={url}
      className={className}
      height={height}
    />
  );
}
