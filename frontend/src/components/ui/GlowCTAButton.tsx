import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "react-router-dom";

import BorderGlow from "@/components/effects/BorderGlow";
import SpecularButton from "@/components/effects/SpecularButton";
import { BORDER_GLOW_BUTTON } from "@/components/effects/presets";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

export type GlowCTAButtonProps = {
  children: ReactNode;
  size?: Size;
  className?: string;
  to?: string;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
};

function InnerSpecular({
  children,
  size = "md",
  loading,
  disabled,
  type = "button",
  onClick,
  to,
}: {
  children: ReactNode;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  to?: string;
}) {
  const label = loading ? "Loading…" : String(children);
  const specularProps = {
    size,
    radius: 18,
    lineColor: "#38bdf8",
    baseColor: "#525252",
    textColor: "#f5f5f5",
    tint: "#0a0a0a",
    tintOpacity: 0.85,
    disabled: disabled || loading,
    className: "w-full font-semibold",
  };

  if (to) {
    return (
      <SpecularButton {...specularProps} to={to} onClick={onClick}>
        {label}
      </SpecularButton>
    );
  }

  return (
    <SpecularButton {...specularProps} type={type} onClick={onClick}>
      {label}
    </SpecularButton>
  );
}

function GlowWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BorderGlow
      {...BORDER_GLOW_BUTTON}
      className={cn("inline-block overflow-visible", className)}
    >
      <div className="p-1 overflow-visible">{children}</div>
    </BorderGlow>
  );
}

export default function GlowCTAButton({
  children,
  size = "md",
  className,
  to,
  loading,
  disabled,
  type = "button",
  onClick,
}: GlowCTAButtonProps) {
  return (
    <GlowWrap className={className}>
      <InnerSpecular
        size={size}
        loading={loading}
        disabled={disabled}
        type={type}
        onClick={onClick}
        to={to}
      >
        {children}
      </InnerSpecular>
    </GlowWrap>
  );
}

export type GlowCTALinkProps = ComponentPropsWithoutRef<typeof Link> & {
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
};

export function GlowCTALink({
  children,
  size = "md",
  className,
  loading,
  disabled,
  to,
  onClick,
}: GlowCTALinkProps) {
  return (
    <GlowWrap className={className}>
      <SpecularButton
        size={size}
        radius={18}
        lineColor="#38bdf8"
        baseColor="#525252"
        textColor="#f5f5f5"
        tint="#0a0a0a"
        tintOpacity={0.85}
        to={typeof to === "string" ? to : ""}
        disabled={disabled || loading}
        onClick={onClick as () => void}
        className="w-full font-semibold"
      >
        {loading ? "Loading…" : String(children)}
      </SpecularButton>
    </GlowWrap>
  );
}
