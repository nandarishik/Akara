import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AkaraButton, SecondaryButton } from "./GradientButton";

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
}

function ActionButton({
  action,
  variant,
}: {
  action: NonNullable<EmptyStateProps["primaryAction"]>;
  variant: "primary" | "secondary";
}) {
  const Btn = variant === "primary" ? AkaraButton : SecondaryButton;
  if (action.href) {
    return (
      <Link to={action.href}>
        <Btn>{action.label}</Btn>
      </Link>
    );
  }
  return <Btn onClick={action.onClick}>{action.label}</Btn>;
}

export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      <div className="max-w-md mx-auto space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-soft text-accent">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-h2">{title}</h3>
          {description && <p className="text-body">{description}</p>}
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
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <EmptyState
      icon={<span className="text-2xl">📭</span>}
      title={title}
      description={description}
      {...(onAction && {
        primaryAction: { label: actionLabel, onClick: onAction },
      })}
    />
  );
}
