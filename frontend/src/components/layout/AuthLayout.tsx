import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Card width — sm (login), md (signup), lg (onboarding) */
  size?: "sm" | "md" | "lg";
  /** Content rendered above the card (e.g. progress dots, back button) */
  above?: ReactNode;
  className?: string;
}

const SIZE_CLASS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

/**
 * AuthLayout — FireAI light auth shell (centered white card on surface-bg).
 */
export function AuthLayout({
  children,
  title,
  subtitle,
  size = "sm",
  above,
  className,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4 py-12">
      <div className={cn("w-full", SIZE_CLASS[size], className)}>
        {above}

        <div className="text-center mb-8">
          <Link
            to="/"
            className="text-3xl font-extrabold text-text-primary font-display hover:text-accent transition-colors"
          >
            AKARA
          </Link>
          {subtitle && (
            <p className="text-text-secondary mt-2 text-lg font-medium">{subtitle}</p>
          )}
        </div>

        <div className="bg-surface-card rounded-2xl border border-surface-border shadow-card p-8">
          {title && (
            <h1 className="text-2xl font-extrabold text-text-primary mb-6">{title}</h1>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
