import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

import { GRADIENT_MAPPING, type GlassIconColor } from "./GlassIcons";
import "./GlassIcons.css";
import "./GlassIcon.css";

export type GlassIconSize = "sm" | "md" | "lg";

export type GlassIconProps = {
  icon: ReactElement;
  color: GlassIconColor | string;
  label: string;
  size?: GlassIconSize;
  active?: boolean;
  className?: string;
  /** When true, renders a span (for use inside Link). */
  decorative?: boolean;
  onClick?: () => void;
};

function backgroundStyle(color: GlassIconColor | string): CSSProperties {
  if (color in GRADIENT_MAPPING) {
    return { background: GRADIENT_MAPPING[color as GlassIconColor] };
  }
  return { background: color };
}

export function GlassIcon({
  icon,
  color,
  label,
  size = "md",
  active = false,
  className,
  decorative = false,
  onClick,
}: GlassIconProps) {
  const inner = (
    <>
      <span className="icon-btn__back" style={backgroundStyle(color)} />
      <span className="icon-btn__front">
        <span className="icon-btn__icon" aria-hidden="true">
          {icon}
        </span>
      </span>
      {!decorative && size !== "sm" ? (
        <span className="icon-btn__label">{label}</span>
      ) : null}
    </>
  );

  const cls = cn(
    "icon-btn",
    `icon-btn--${size}`,
    active && "icon-btn--active",
    decorative && "icon-btn--decorative",
    className
  );

  if (decorative) {
    return (
      <span className={cls} aria-hidden="true">
        {inner}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {inner}
    </button>
  );
}

/** Wrap arbitrary icon nodes in glass when not using lucide directly. */
export function GlassIconSlot({
  children,
  color,
  label,
  size = "lg",
}: {
  children: ReactNode;
  color: GlassIconColor;
  label: string;
  size?: GlassIconSize;
}) {
  return (
    <GlassIcon
      icon={<span className="glass-icon-slot-inner">{children}</span>}
      color={color}
      label={label}
      size={size}
    />
  );
}
