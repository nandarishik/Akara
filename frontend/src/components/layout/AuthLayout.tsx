import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import DarkMeshBackground from "@/components/effects/DarkMeshBackground";
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";

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
 * AuthLayout — dark glow auth shell (mesh background + GlowSurfaceCard).
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
    <div className="theme-product-dark min-h-screen relative flex items-center justify-center px-4 py-12">
      <DarkMeshBackground className="fixed inset-0 opacity-30 pointer-events-none" />

      <div className={cn("relative z-10 w-full", SIZE_CLASS[size], className)}>
        {above}

        <div className="text-center mb-8">
          <Link
            to="/"
            className="text-3xl font-extrabold text-white font-display hover:text-[#03B3C3] transition-colors"
          >
            AKARA
          </Link>
          {subtitle && (
            <p className="text-white/70 mt-2 text-lg font-medium">{subtitle}</p>
          )}
        </div>

        <GlowSurfaceCard padding="lg" accent="blue">
          {title && (
            <h1 className="text-2xl font-extrabold text-white mb-6">{title}</h1>
          )}
          {children}
        </GlowSurfaceCard>
      </div>
    </div>
  );
}

export default AuthLayout;
