import * as React from "react"
import { Lock } from "lucide-react"
import { GlassIcon } from "@/components/effects/GlassIcon"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

/* ─── Base shadcn Card primitives ─────────────────────────────────────────── */

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-surface-border bg-surface-card text-card-foreground shadow-card transition-shadow duration-200",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight text-text-primary",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-text-secondary", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

/* ─── AKARA card variants — UI Bible §1.4 ────────────────────────────────── */

type KPIAccent = "brand" | "amber" | "success" | "danger" | "info"

const KPI_ACCENT_BORDER: Record<KPIAccent, string> = {
  brand: "border-l-brand",
  amber: "border-l-accent-amber",
  success: "border-l-success",
  danger: "border-l-danger",
  info: "border-l-info",
}

interface KPICardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string
  change?: string
  changeVariant?: "positive" | "negative" | "neutral"
  accent?: KPIAccent
  loading?: boolean
}

function KPICard({
  label,
  value,
  change,
  changeVariant = "neutral",
  accent = "brand",
  loading = false,
  className,
  ...props
}: KPICardProps) {
  return (
    <Card
      className={cn(
        "card-hover border-l-4 p-6",
        KPI_ACCENT_BORDER[accent],
        className
      )}
      {...props}
    >
      <p className="caption uppercase tracking-wider text-text-muted">{label}</p>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      ) : (
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="kpi-value animate-number-pop">{value}</p>
          {change && (
            <Badge variant={`change-${changeVariant}` as "change-positive"}>
              {change}
            </Badge>
          )}
        </div>
      )}
    </Card>
  )
}

interface PlanCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  price: string
  period?: string
  description?: string
  features?: string[]
  popular?: boolean
  cta?: React.ReactNode
  current?: boolean
}

function PlanCard({
  name,
  price,
  period = "/ month",
  description,
  features = [],
  popular = false,
  cta,
  current = false,
  className,
  ...props
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        "card-hover relative flex flex-col rounded-2xl border-2 p-6",
        popular ? "border-accent shadow-card-hover ring-1 ring-accent/20" : "border-surface-border",
        current && "ring-2 ring-accent/30",
        className
      )}
      {...props}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="plan-pro" className="shadow-sm">
            Most popular
          </Badge>
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary">{name}</h3>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      <div className="mb-6">
        <span className="text-3xl font-bold text-text-primary">{price}</span>
        <span className="text-sm text-text-muted">{period}</span>
      </div>
      {features.length > 0 && (
        <ul className="mb-6 flex-1 space-y-2 text-sm text-text-secondary">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="text-success" aria-hidden="true">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>
      )}
      {cta && <div className="mt-auto">{cta}</div>}
    </Card>
  )
}

interface LockedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  upgradeLabel?: string
  upgradeHref?: string
  children?: React.ReactNode
}

function LockedCard({
  title,
  description,
  upgradeLabel = "Upgrade to Pro",
  upgradeHref = "/upgrade",
  children,
  className,
  ...props
}: LockedCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)} {...props}>
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm opacity-60">
          {children ?? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm p-6 text-center">
          <GlassIcon
            decorative
            size="lg"
            color="red"
            icon={<Lock className="h-6 w-6" />}
            label={title}
          />
          <p className="font-semibold text-text-primary">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          )}
          <Link
            to={upgradeHref}
            className="mt-4 text-sm font-semibold text-brand hover:text-brand-light hover:underline"
          >
            {upgradeLabel} →
          </Link>
        </div>
      </div>
    </Card>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  KPICard,
  PlanCard,
  LockedCard,
}
