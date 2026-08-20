import { Link } from "react-router-dom";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { usePlacementSlot } from "@/shared/hooks/usePlacementSlot";

interface PromoDismissCardProps {
  slotKey?: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  onDismiss: () => void;
  accent?: "amber" | "blue" | "green";
}

export function PromoDismissCard({
  slotKey,
  title,
  description,
  ctaLabel,
  ctaTo,
  onDismiss,
  accent = "amber",
}: PromoDismissCardProps) {
  const fallback = { title, body: description, cta_label: ctaLabel, cta_link: ctaTo };
  const { content, trackClick } = usePlacementSlot(slotKey ?? "", slotKey ? fallback : null);

  const displayTitle = slotKey ? String(content?.title ?? title) : title;
  const displayBody = slotKey ? String(content?.body ?? description) : description;
  const displayCta = slotKey ? String(content?.cta_label ?? ctaLabel) : ctaLabel;
  const displayLink = slotKey ? String(content?.cta_link ?? ctaTo) : ctaTo;

  return (
    <GlowSurfaceCard accent={accent} className="animate-fadeInUp">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm text-text-primary">{displayTitle}</p>
          <p className="text-xs text-text-muted mt-0.5">{displayBody}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={displayLink}
            onClick={() => trackClick()}
            className="text-sm font-semibold text-accent hover:underline"
          >
            {displayCta}
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
