"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EVIDENCE_SECTIONS,
  type EvidenceSectionId,
} from "@/components/evidence/evidence-section-nav";

interface Options {
  showDecision: boolean;
  showRealtorVerification?: boolean;
  headerId: string;
}

export function useEvidenceSectionNavigation({
  showDecision,
  showRealtorVerification = false,
  headerId,
}: Options) {
  const [activeSection, setActiveSection] = useState<EvidenceSectionId>("summary");

  useEffect(() => {
    const sections = EVIDENCE_SECTIONS.filter(
      ({ id }) =>
        (showDecision || id !== "decision") &&
        (showRealtorVerification || id !== "realtor-verification"),
    );
    let frame = 0;

    const update = () => {
      frame = 0;
      const headerBottom = document.getElementById(headerId)?.getBoundingClientRect().bottom ?? 0;
      const firstSection = document.getElementById(sections[0].id);
      const scrollMargin = firstSection
        ? Number.parseFloat(getComputedStyle(firstSection).scrollMarginTop) || 0
        : 0;
      const threshold = Math.max(0, headerBottom, scrollMargin) + 16;
      let current = sections[0].id;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= threshold) {
          current = section.id;
        }
      }

      // The final section can stop short of the header when the page reaches its end.
      const last = document.getElementById(sections[sections.length - 1].id);
      if (last) {
        let scrollParent: HTMLElement | null = last.parentElement;
        while (scrollParent) {
          const overflow = getComputedStyle(scrollParent).overflowY;
          if (
            (overflow === "auto" || overflow === "scroll") &&
            scrollParent.scrollHeight > scrollParent.clientHeight
          ) {
            break;
          }
          scrollParent = scrollParent.parentElement;
        }
        const visibleBottom = Math.min(
          window.innerHeight,
          scrollParent?.getBoundingClientRect().bottom ?? window.innerHeight,
        );
        if (last.getBoundingClientRect().bottom <= visibleBottom - 24) {
          current = sections[sections.length - 1].id;
        }
      }

      setActiveSection((previous) => (previous === current ? previous : current));
    };

    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headerId, showDecision, showRealtorVerification]);

  const selectSection = useCallback((id: EvidenceSectionId) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, []);

  return { activeSection, selectSection };
}
