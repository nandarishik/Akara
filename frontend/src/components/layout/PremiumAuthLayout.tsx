import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import DarkMeshBackground from "@/components/effects/DarkMeshBackground";
import ReflectiveCard from "@/components/effects/ReflectiveCard";
import PrismLazy from "@/components/effects/PrismLazy";

interface PremiumAuthLayoutProps {
  children: ReactNode;
  subtitle?: string;
  above?: ReactNode;
  className?: string;
}

export function PremiumAuthLayout({
  children,
  subtitle,
  above,
  className,
}: PremiumAuthLayoutProps) {
  return (
    <div className="theme-product-dark relative flex min-h-screen items-center justify-center px-4 py-12">
      <DarkMeshBackground className="pointer-events-none fixed inset-0 opacity-30" />
      <PrismLazy
        className="pointer-events-none fixed inset-0 opacity-25"
        animationType="rotate"
        timeScale={0.3}
        suspendWhenOffscreen
      />

      <div className={cn("relative z-10 w-full max-w-lg", className)}>
        {above}

        <div className="mb-8 text-center">
          <Link
            to="/"
            className="font-display text-3xl font-extrabold text-white transition-colors hover:text-[#03B3C3]"
          >
            AKARA
          </Link>
          {subtitle && (
            <p className="mt-2 text-lg font-medium text-white/70">{subtitle}</p>
          )}
        </div>

        <ReflectiveCard variant="auth" badgeText="SECURE SIGNUP" className="w-full">
          {children}
        </ReflectiveCard>
      </div>
    </div>
  );
}

export default PremiumAuthLayout;
