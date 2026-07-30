import { Link } from "react-router-dom";
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";

interface PromoDismissCardProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  onDismiss: () => void;
  accent?: "amber" | "blue" | "green";
}

export function PromoDismissCard({
  title,
  description,
  ctaLabel,
  ctaTo,
  onDismiss,
  accent = "amber",
}: PromoDismissCardProps) {
  return (
    <GlowSurfaceCard accent={accent} className="animate-fadeInUp">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm text-text-primary">{title}</p>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={ctaTo}
            className="text-sm font-semibold text-accent hover:underline"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Dismiss
          </button>
        </div>
      </div>
    </GlowSurfaceCard>
  );
}
