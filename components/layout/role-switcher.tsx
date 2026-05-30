"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ROLE_CONFIG } from "@/lib/domain/constants";
import type { UserRole } from "@/lib/domain/types";
import { ACTIONS, ROLES } from "@/lib/i18n/labels";
import { useCurrentRole, useSetCurrentRole } from "@/lib/services/hooks";
import { cn } from "@/lib/utils";

const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  realtor: "/demo/agente",
  notary: "/demo/notario",
  landlord: "/demo/arrendador",
  renter: "/demo/arrendatario",
};

const ROLES_ORDER: UserRole[] = ["realtor", "notary", "landlord", "renter"];

export function RoleSwitcher() {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const currentRole = useCurrentRole();
  const setCurrentRole = useSetCurrentRole();

  const currentLabel = ROLES[currentRole];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleSelect(role: UserRole) {
    setCurrentRole(role);
    setOpen(false);
    router.push(ROLE_DASHBOARD_PATHS[role]);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={`${ACTIONS.seleccionarRol}: ${currentLabel}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-primary",
          "hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
      >
        <span>{currentLabel}</span>
        <ChevronDown
          className={cn("size-4 text-muted transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ACTIONS.seleccionarRol}
          className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-md border border-border bg-background py-1 shadow-sm"
        >
          {ROLES_ORDER.map((role) => (
            <li key={role} role="option" aria-selected={role === currentRole}>
              <button
                type="button"
                onClick={() => handleSelect(role)}
                className={cn(
                  "flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-surface",
                  role === currentRole && "bg-surface font-medium",
                )}
              >
                <span className="text-primary">{ROLES[role]}</span>
                <span className="text-xs text-muted">{ROLE_CONFIG[role].description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
