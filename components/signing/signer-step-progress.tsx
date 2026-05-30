"use client";

import { cn } from "@/lib/utils";

export interface SignerStepProgressProps {
  currentStep: number;
  steps: string[];
}

export function SignerStepProgress({
  currentStep,
  steps,
}: SignerStepProgressProps) {
  return (
    <div className="w-full py-4" aria-label="Progreso del proceso de firma">
      <div className="flex items-center justify-between">
        {steps.map((label, index) => {
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
              {index < steps.length - 1 ? (
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
        {steps[currentStep]}
      </p>
    </div>
  );
}
