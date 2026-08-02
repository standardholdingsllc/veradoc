"use client";

import { useRef, useCallback, useEffect } from "react";
import { z } from "zod";

declare global {
  interface Window {
    Culqi3DS: {
      publicKey: string;
      settings: Record<string, unknown>;
      options: Record<string, unknown>;
      generateDevice: () => Promise<string | null>;
      initAuthentication: (tokenId: string) => Promise<void>;
      reset: () => void;
    };
  }
}

const ThreeDSParamsSchema = z.object({
  eci: z.string().min(1),
  xid: z.string().min(1),
  cavv: z.string().min(1),
  protocolVersion: z.string().optional(),
  directoryServerTransactionId: z.string().optional(),
});

export type ThreeDSParams = z.infer<typeof ThreeDSParamsSchema>;

interface UseCulqi3DSOptions {
  publicKey: string;
  onResult: (params: ThreeDSParams) => void;
  onError: (message: string) => void;
}

export function useCulqi3DS({ publicKey, onResult, onError }: UseCulqi3DSOptions) {
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.parameters3DS) {
        const parsed = ThreeDSParamsSchema.safeParse(data.parameters3DS);
        if (parsed.success) {
          onResultRef.current(parsed.data);
        } else {
          onErrorRef.current("Parámetros 3DS inválidos.");
        }
      } else if (data.error) {
        onErrorRef.current(typeof data.error === "string" ? data.error : "Error en la autenticación 3DS.");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.Culqi3DS?.reset();
    };
  }, []);

  const generateDevice = useCallback(async (): Promise<string | null> => {
    if (!window.Culqi3DS) return null;
    window.Culqi3DS.publicKey = publicKey;
    return window.Culqi3DS.generateDevice();
  }, [publicKey]);

  const initAuthentication = useCallback(async (tokenId: string, amountCentimos: number, email: string) => {
    if (!window.Culqi3DS) {
      onErrorRef.current("Culqi3DS no disponible.");
      return;
    }
    window.Culqi3DS.publicKey = publicKey;
    window.Culqi3DS.settings = {
      charge: { totalAmount: amountCentimos, currency: "PEN", returnUrl: window.location.origin },
      card: { email },
    };
    await window.Culqi3DS.initAuthentication(tokenId);
  }, [publicKey]);

  const reset = useCallback(() => {
    window.Culqi3DS?.reset();
  }, []);

  return { generateDevice, initAuthentication, reset };
}
