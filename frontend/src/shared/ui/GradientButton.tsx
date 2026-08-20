import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

/**
 * AkaraButton — FireAI pill CTA (44px touch target, press-only animation).
 * GradientButton is kept as a default export alias for migration.
 */
export function AkaraButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = cn(
    "btn-press inline-flex items-center justify-center gap-2 font-semibold rounded-full",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "active:scale-[0.97]",
    size === "sm" && "min-h-9 px-4 text-sm",
    size === "md" && "min-h-11 px-6 text-[15px]",
    size === "lg" && "min-h-12 px-8 text-base"
  );

  const variantClasses = {
    primary: cn(
      "bg-accent text-white shadow-cta",
      "hover:bg-accent-hover"
    ),
    secondary: cn(
      "bg-transparent border-2 border-accent text-accent",
      "hover:bg-accent-soft"
    ),
    ghost: cn(
      "bg-transparent text-text-secondary",
      "hover:bg-surface-raised hover:text-text-primary"
    ),
  };

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span
            className={cn(
              "w-4 h-4 border-2 rounded-full animate-spin",
              variant === "primary"
                ? "border-white/30 border-t-white"
                : "border-accent/30 border-t-accent"
            )}
            aria-hidden
          />
          Loading…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export default AkaraButton;

export function SecondaryButton(props: Omit<ButtonProps, "variant">) {
  return <AkaraButton variant="secondary" {...props} />;
}

export function GhostButton(props: Omit<ButtonProps, "variant">) {
  return <AkaraButton variant="ghost" type="button" {...props} />;
}

/** @deprecated Use AkaraButton */
export const GradientButton = AkaraButton;
