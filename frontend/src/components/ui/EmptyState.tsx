import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { GlassIcon } from "@/components/effects/GlassIcon";
import type { GlassIconColor } from "@/components/effects/GlassIcons";
import Folder from "@/components/effects/Folder";
import GlowCTAButton from "@/components/ui/GlowCTAButton";
import { SecondaryButton } from "./GradientButton";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  children?: ReactNode;
  className?: string;
  iconColor?: GlassIconColor;
  variant?: "default" | "folder";
  folderColor?: string;
}

function ActionButton({
  action,
  variant,
}: {
  action: NonNullable<EmptyStateProps["primaryAction"]>;
  variant: "primary" | "secondary";
}) {
  if (variant === "primary") {
    if (action.href) {
      return (
        <GlowCTAButton to={action.href} size="sm">
          {action.label}
        </GlowCTAButton>
      );
    }
    return (
      <GlowCTAButton size="sm" onClick={action.onClick}>
        {action.label}
      </GlowCTAButton>
    );
  }
  const Btn = SecondaryButton;
  if (action.href) {
    return (
      <Link to={action.href}>
        <Btn className="border-white/20 text-white/70 hover:bg-white/10">{action.label}</Btn>
      </Link>
    );
  }
  return <Btn onClick={action.onClick} className="border-white/20 text-white/70 hover:bg-white/10">{action.label}</Btn>;
}

export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className,
  iconColor = "blue",
  variant = "default",
  folderColor = "#03B3C3",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      <div className="max-w-md mx-auto space-y-6">
        {variant === "folder" ? (
          <div className="flex justify-center py-4">
            <Folder color={folderColor} size={1.4} items={[icon]} />
          </div>
        ) : (
          <GlassIcon
            decorative
            size="lg"
            color={iconColor}
            icon={<span className="glass-icon-slot-inner [&_svg]:h-7 [&_svg]:w-7">{icon}</span>}
            label={title}
          />
        )}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          {description && <p className="text-sm text-white/60">{description}</p>}
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {primaryAction && (
              <ActionButton action={primaryAction} variant="primary" />
            )}
            {secondaryAction && (
              <ActionButton action={secondaryAction} variant="secondary" />
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function DashboardEmptyState() {
  return (
    <EmptyState
      icon={<span className="text-2xl">📊</span>}
      title="Your dashboard awaits data"
      description="Import your first sales file to unlock insights and live KPIs."
      primaryAction={{ label: "Import Data", href: "/data" }}
    />
  );
}

export function CopilotEmptyState() {
  return (
    <EmptyState
      icon={<span className="text-2xl">✦</span>}
      title="Ask AKARA anything"
      description="Your AI copilot is ready to analyze data and answer questions."
      primaryAction={{ label: "Start conversation", href: "/copilot" }}
    />
  );
}

export function NoDataEmptyState({
  title = "No data available",
  description = "There's nothing to show here yet.",
  actionLabel = "Refresh",
  onAction,
  variant = "default" as "default" | "folder",
  icon,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "folder";
  icon?: ReactNode;
}) {
  return (
    <EmptyState
      variant={variant}
      icon={icon ?? (variant === "folder" ? <span className="text-lg">📄</span> : <span className="text-2xl">📭</span>)}
      title={title}
      description={description}
      {...(onAction && {
        primaryAction: { label: actionLabel, onClick: onAction },
      })}
    />
  );
}
