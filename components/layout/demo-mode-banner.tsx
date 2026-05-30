"use client";

import { Info } from "lucide-react";
import { NAV } from "@/lib/i18n/labels";

export function DemoModeBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-slate-300 bg-slate-100"
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-700">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        <span>{NAV.modoDemo}</span>
      </div>
    </div>
  );
}
