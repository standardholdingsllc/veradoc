"use client";

import { AlertTriangle } from "lucide-react";
import { REGISTRY } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export interface RegistryWarningBannerProps {
  message?: string;
  className?: string;
}

export function RegistryWarningBanner({
  message = REGISTRY.alertaDuplicadoMultiple,
  className,
}: RegistryWarningBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
