import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-slate-200 animate-pulse-soft",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

function KPICardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
      aria-busy="true"
      aria-label="Loading KPIs"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-surface-border bg-surface-card p-6 space-y-3"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

interface TableSkeletonProps {
  rows?: number
  cols?: number
  className?: string
}

function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div
      className={cn("space-y-3", className)}
      aria-busy="true"
      aria-label="Loading table"
    >
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`head-${i}`} className="h-4 w-full" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="grid gap-4 py-2 border-b border-surface-border"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={`${row}-${col}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-surface-border bg-surface-card p-6",
        className
      )}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="flex h-48 items-end justify-between gap-2">
        {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function ChatSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-4 p-4", className)}
      aria-busy="true"
      aria-label="Loading conversation"
    >
      <div className="flex justify-end">
        <Skeleton className="h-16 w-3/5 rounded-2xl rounded-tr-sm" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-24 w-4/5 rounded-2xl rounded-tl-sm" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-2/5 rounded-2xl rounded-tr-sm" />
      </div>
    </div>
  )
}

interface CardListSkeletonProps {
  count?: number
  className?: string
}

function CardListSkeleton({ count = 3, className }: CardListSkeletonProps) {
  return (
    <div
      className={cn("space-y-4", className)}
      aria-busy="true"
      aria-label="Loading cards"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-surface-border bg-surface-card p-6 space-y-3"
        >
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}

function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-2 mb-8", className)}
      aria-busy="true"
      aria-label="Loading page header"
    >
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  )
}

export {
  Skeleton,
  KPICardSkeleton,
  TableSkeleton,
  ChartSkeleton,
  ChatSkeleton,
  CardListSkeleton,
  PageHeaderSkeleton,
}
