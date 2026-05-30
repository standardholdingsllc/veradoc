import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const variantStyles = {
  default: "bg-primary text-white hover:bg-primary/90 border border-primary",
  secondary:
    "bg-secondary text-white hover:bg-secondary/90 border border-secondary",
  outline:
    "bg-transparent text-primary border border-border hover:bg-surface",
  ghost: "bg-transparent text-primary hover:bg-surface border border-transparent",
  destructive:
    "bg-accent text-white hover:bg-accent/90 border border-accent",
} as const;

const sizeStyles = {
  sm: "h-8 px-3 text-xs",
  default: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "default", size = "default", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    );
  },
);
