"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SigningContext } from "@/lib/signing/resolve-context";

const ProductionSigningContext = createContext<SigningContext | null>(null);

export function SigningContextProvider({
  value,
  children,
}: {
  value: SigningContext;
  children: ReactNode;
}) {
  return (
    <ProductionSigningContext.Provider value={value}>
      {children}
    </ProductionSigningContext.Provider>
  );
}

export function useProductionSignerContext(): SigningContext {
  const ctx = useContext(ProductionSigningContext);
  if (!ctx) {
    throw new Error(
      "useProductionSignerContext must be used within a SigningContextProvider",
    );
  }
  return ctx;
}
