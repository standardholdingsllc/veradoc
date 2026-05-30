"use client";

import { useEffect } from "react";

export function PaperParallax() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reduceMotion.matches) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      document.documentElement.style.setProperty(
        "--paper-shift",
        `${window.scrollY}px`,
      );
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.style.removeProperty("--paper-shift");
    };
  }, []);

  return null;
}
