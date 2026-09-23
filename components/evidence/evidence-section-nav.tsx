"use client";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  FileCheck,
  FileText,
  Fingerprint,
  Gavel,
  Hash,
  History,
  Home,
  ShieldCheck,
  Users,
} from "lucide-react";
import { EVIDENCE } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export const EVIDENCE_SECTION_IDS = [
  "summary",
  "lease-document",
  "signed-document",
  "signer-evidence",
  "signature-validation",
  "hash-history",
  "property-evidence",
  "registry-check",
  "audit-trail",
  "realtor-verification",
  "system-flags",
  "checklist",
  "decision",
] as const;

export type EvidenceSectionId = (typeof EVIDENCE_SECTION_IDS)[number];

export const EVIDENCE_SECTIONS: {
  id: EvidenceSectionId;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: "summary", label: EVIDENCE.resumenPaquete, icon: ClipboardList },
  { id: "lease-document", label: EVIDENCE.documentoArrendamiento, icon: FileText },
  { id: "signed-document", label: EVIDENCE.documentoFirmado, icon: FileCheck },
  { id: "signer-evidence", label: EVIDENCE.evidenciaFirmante, icon: Users },
  { id: "signature-validation", label: EVIDENCE.validacionFirma, icon: ShieldCheck },
  { id: "hash-history", label: EVIDENCE.historialHashes, icon: Hash },
  { id: "property-evidence", label: EVIDENCE.evidenciaPropiedad, icon: Home },
  { id: "registry-check", label: EVIDENCE.verificacionRegistro, icon: Fingerprint },
  { id: "audit-trail", label: EVIDENCE.registrosSesion, icon: History },
  { id: "realtor-verification", label: "Verificación del agente", icon: ShieldCheck },
  { id: "system-flags", label: EVIDENCE.banderasSistema, icon: AlertTriangle },
  { id: "checklist", label: EVIDENCE.listaVerificacion, icon: CheckSquare },
  { id: "decision", label: EVIDENCE.panelDecision, icon: Gavel },
];

interface EvidenceSectionNavProps {
  activeSection: EvidenceSectionId;
  onSectionSelect: (id: EvidenceSectionId) => void;
  showDecision?: boolean;
  showRealtorVerification?: boolean;
  className?: string;
}

export function EvidenceSectionNav({
  activeSection,
  onSectionSelect,
  showDecision = true,
  showRealtorVerification = false,
  className,
}: EvidenceSectionNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const sections = EVIDENCE_SECTIONS.filter(
    (section) =>
      (showDecision || section.id !== "decision") &&
      (showRealtorVerification || section.id !== "realtor-verification"),
  );

  useEffect(() => {
    const nav = navRef.current;
    const button = nav?.querySelector<HTMLElement>(`[data-section-id="${activeSection}"]`);
    if (!nav || !button) return;

    const navBounds = nav.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    if (buttonBounds.top < navBounds.top + 12 || buttonBounds.bottom > navBounds.bottom - 12) {
      nav.scrollTo({
        top: nav.scrollTop + buttonBounds.top - navBounds.top - nav.clientHeight / 2 + button.clientHeight / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [activeSection]);

  return (
    <nav
      ref={navRef}
      aria-label="Secciones de evidencia"
      className={cn("flex max-h-[calc(100dvh-8rem)] flex-col overflow-y-auto", className)}
    >
      <div className="border-b border-border px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          {EVIDENCE.informeEvidencia}
        </p>
      </div>
      <ul className="flex flex-col gap-0.5 p-2">
        {sections.map((section, index) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <li key={section.id}>
              <button
                type="button"
                data-section-id={section.id}
                aria-current={active ? "step" : undefined}
                onClick={() => onSectionSelect(section.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-surface hover:text-primary",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded font-mono text-[9px] font-semibold",
                    active ? "bg-white/20 text-white" : "bg-surface text-muted",
                  )}
                >
                  {index + 1}
                </span>
                <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="leading-snug">{section.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
