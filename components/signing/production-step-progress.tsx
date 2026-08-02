"use client";

import { cn } from "@/lib/utils";
import { PRODUCTION_STEP_LABELS } from "@/lib/domain/production-signer-machine";

export interface ProductionStepProgressProps {
  currentStep: number;
}

export function ProductionStepProgress({ currentStep }: ProductionStepProgressProps) {
  return (
    <div className="w-full py-4" aria-label="Progreso del proceso de firma">
      <div className="flex items-center justify-between">
        {PRODUCTION_STEP_LABELS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-3 shrink-0 items-center justify-center rounded-full transition-colors sm:size-3.5",
                    isCompleted && "bg-success",
                    isCurrent && "bg-secondary ring-4 ring-secondary/20",
                    isFuture && "bg-border",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                />
              </div>
              {index < PRODUCTION_STEP_LABELS.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1 transition-colors",
                    index < currentStep ? "bg-success" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-medium text-secondary">
        {PRODUCTION_STEP_LABELS[currentStep]}
      </p>
    </div>
  );
}
