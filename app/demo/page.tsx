"use client";

import { useRouter } from "next/navigation";
import { Building2, Home, Scale, User } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  NAV,
  PAGE_TITLES,
  ROLE_CARD_DESCRIPTIONS,
  ROLES,
} from "@/lib/i18n/labels";
import { useSetCurrentRole } from "@/lib/services/hooks";
import type { UserRole } from "@/lib/domain/types";

const ROLE_OPTIONS: {
  role: UserRole;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  href: string;
}[] = [
  {
    role: "realtor",
    icon: Building2,
    description: ROLE_CARD_DESCRIPTIONS.realtor,
    href: "/demo/agente",
  },
  {
    role: "landlord",
    icon: Home,
    description: ROLE_CARD_DESCRIPTIONS.landlord,
    href: "/demo/arrendador",
  },
  {
    role: "renter",
    icon: User,
    description: ROLE_CARD_DESCRIPTIONS.renter,
    href: "/demo/arrendatario",
  },
  {
    role: "notary",
    icon: Scale,
    description: ROLE_CARD_DESCRIPTIONS.notary,
    href: "/demo/notario",
  },
];

export default function DemoPage() {
  const router = useRouter();
  const setCurrentRole = useSetCurrentRole();

  function handleEnter(role: UserRole, href: string) {
    setCurrentRole(role);
    router.push(href);
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-12 md:py-16">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          Modo demostración
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Explore el flujo completo del paquete de arrendamiento desde la
          perspectiva de cada rol.
        </p>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => (
          <Card key={option.role} className="flex flex-col">
            <CardHeader>
              <option.icon
                className="size-6 text-secondary"
                aria-hidden="true"
              />
              <CardTitle className="text-lg">{ROLES[option.role]}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm leading-relaxed text-muted">
                {option.description}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handleEnter(option.role, option.href)}
              >
                Entrar
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        {PAGE_TITLES.demo} — {NAV.modoDemo}
      </p>
    </div>
  );
}
