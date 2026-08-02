"use client";

import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm?: () => void;
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  confirmVariant = "default",
  onConfirm,
  loading,
  children,
  className,
}: DialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className={cn("w-full max-w-md shadow-lg", className)}>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2
              id="dialog-title"
              className="text-base font-semibold text-primary"
            >
              {title}
            </h2>
            {message && <p className="mt-1 text-sm text-muted">{message}</p>}
          </div>
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {onConfirm && confirmLabel && (
              <Button
                type="button"
                variant={confirmVariant}
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? "Procesando..." : confirmLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
