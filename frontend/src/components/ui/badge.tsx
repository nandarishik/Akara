import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-brand text-white hover:bg-brand-light",
        secondary:
          "border-transparent bg-surface-raised text-text-secondary hover:bg-surface-border",
        destructive:
          "border-transparent bg-danger text-white hover:bg-red-600",
        outline: "border-surface-border text-text-primary bg-transparent",
        "plan-free": "border-transparent bg-slate-100 text-slate-600",
        "plan-pro": "border-transparent bg-violet-100 text-violet-700",
        "plan-business": "border-transparent bg-amber-100 text-amber-700",
        "status-active": "border-transparent bg-emerald-100 text-emerald-700",
        "status-trialing": "border-transparent bg-blue-100 text-blue-700",
        "status-past_due": "border-transparent bg-red-100 text-red-700",
        "status-cancelled": "border-transparent bg-slate-100 text-slate-500",
        "change-positive": "border-transparent bg-emerald-50 text-emerald-700",
        "change-negative": "border-transparent bg-red-50 text-red-700",
        "change-neutral": "border-transparent bg-slate-100 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

type Plan = "free" | "pro" | "business"
type PlanStatus = "active" | "trialing" | "past_due" | "cancelled"

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro ✦",
  business: "Business ✦✦",
}

const STATUS_LABELS: Record<PlanStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past Due",
  cancelled: "Cancelled",
}

interface PlanBadgeProps extends Omit<BadgeProps, "variant"> {
  plan: Plan
  status?: PlanStatus
  showStatus?: boolean
}

function PlanBadge({
  plan,
  status,
  showStatus = false,
  className,
  ...props
}: PlanBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant={`plan-${plan}` as "plan-free"}
        className={className}
        {...props}
      >
        {PLAN_LABELS[plan]}
      </Badge>
      {showStatus && status && (
        <Badge variant={`status-${status}` as "status-active"}>
          {STATUS_LABELS[status]}
        </Badge>
      )}
    </span>
  )
}

export { Badge, badgeVariants, PlanBadge }
export type { Plan, PlanStatus }
