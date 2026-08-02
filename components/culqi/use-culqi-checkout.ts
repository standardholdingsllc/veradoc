"use client";

import { useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    CulqiCheckout: new (publicKey: string, config: Record<string, unknown>) => CulqiCheckoutInstance;
  }
}

interface CulqiCheckoutInstance {
  open: () => void;
  close: () => void;
  token: { id: string } | null;
  order: unknown;
  error: { user_message: string; merchant_message: string } | null;
  culqi: (() => void) | null;
}

export interface CheckoutConfig {
  publicKey: string;
  paymentId: string;
  amountCentimos: number;
  currency: string;
  email: string;
}

interface UseCulqiCheckoutOptions {
  onToken: (tokenId: string) => void;
  onError: (message: string) => void;
}

export function useCulqiCheckout({ onToken, onError }: UseCulqiCheckoutOptions) {
  const instanceRef = useRef<CulqiCheckoutInstance | null>(null);
  const configKeyRef = useRef<string>("");
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const [isOpen, setIsOpen] = useState(false);

  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  const buildInstance = useCallback((config: CheckoutConfig) => {
    const key = `${config.paymentId}:${config.amountCentimos}:${config.currency}:${config.email}`;

    if (instanceRef.current && configKeyRef.current !== key) {
      instanceRef.current.close?.();
      instanceRef.current = null;
    }

    if (instanceRef.current) return instanceRef.current;

    if (!window.CulqiCheckout) {
      onErrorRef.current("Sistema de pagos no disponible.");
      return null;
    }

    const instance = new window.CulqiCheckout(config.publicKey, {
      settings: { title: "VeraDoc", currency: config.currency, amount: config.amountCentimos },
      client: { email: config.email },
      options: {
        lang: "es",
        installments: false,
        modal: true,
        paymentMethods: { tarjeta: true, yape: true },
        paymentMethodsSort: ["tarjeta", "yape"],
      },
      appearance: {
        theme: "default",
        hiddenCulqiLogo: false,
        menuType: "sliderTop",
        defaultStyle: {
          bannerColor: "#00427E",
          buttonBackground: "#00427E",
          buttonTextColor: "#FFFFFF",
          linksColor: "#00427E",
        },
      },
    });

    instance.culqi = () => {
      if (instance.token) {
        const tokenId = instance.token.id;
        instance.close();
        setIsOpen(false);
        onTokenRef.current(tokenId);
      } else if (instance.error) {
        setIsOpen(false);
        onErrorRef.current(instance.error.user_message || "Error en el pago.");
      }
    };

    instanceRef.current = instance;
    configKeyRef.current = key;
    return instance;
  }, []);

  const open = useCallback((config: CheckoutConfig) => {
    const instance = buildInstance(config);
    if (instance) {
      instance.open();
      setIsOpen(true);
    }
  }, [buildInstance]);

  return { open, isOpen };
}
