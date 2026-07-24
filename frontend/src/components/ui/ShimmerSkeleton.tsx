import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  count?: number
  style?: React.CSSProperties
}

/**
 * ShimmerSkeleton - Blue-tinted loading states for the AKARA Blue system
 * 
 * Features:
 * - Base: navy glass background (rgba(10,31,61,0.5))
 * - Blue-tinted borders (rgba(33,150,243,0.08))
 * - Blue shimmer sweep: via-[rgba(33,150,243,0.08)]
 * - Specialized variants for KPIs, Charts, Tables
 * - Staggered animation delays for lists
 */
export default function ShimmerSkeleton({ className, count = 1, style }: SkeletonProps) {
  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={cn('skeleton', className)}
            style={{ 
              animationDelay: `${i * 100}ms`,
              ...style
            }}
          />
        ))}
      </>
    )
  }

  return <div className={cn('skeleton', className)} style={style} />
}

/**
 * KPISkeleton - Loading state for KPI cards
 */
export function KPISkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 space-y-4', className)}>
      {/* KPI title */}
      <ShimmerSkeleton className="h-4 w-24" />
      
      {/* KPI value */}
      <div className="flex items-end gap-3">
        <ShimmerSkeleton className="h-10 w-32" />
        <ShimmerSkeleton className="h-6 w-16 mb-1" />
      </div>
      
      {/* Change indicator */}
      <div className="flex items-center gap-2">
        <ShimmerSkeleton className="h-4 w-4 rounded-full" />
        <ShimmerSkeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

/**
 * ChartSkeleton - Loading state for charts
 */
export function ChartSkeleton({ 
  className,
  height = 'h-64'
}: { 
  className?: string
  height?: string 
}) {
  return (
    <div className={cn('p-6', className)}>
      {/* Chart header */}
      <div className="flex items-center justify-between mb-6">
        <ShimmerSkeleton className="h-6 w-40" />
        <ShimmerSkeleton className="h-8 w-24 rounded-lg" />
      </div>
      
      {/* Chart area */}
      <div className={cn('relative', height)}>
        <ShimmerSkeleton className="absolute inset-0 rounded-xl" />
        
        {/* Fake chart bars with staggered heights */}
        <div className="absolute bottom-4 left-6 right-6 flex items-end gap-2">
          {[40, 60, 35, 70, 45, 55, 30].map((height, i) => (
            <ShimmerSkeleton 
              key={i}
              className={`flex-1 rounded-t`}
              style={{ 
                height: `${height}%`,
                animationDelay: `${i * 150}ms`
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <ShimmerSkeleton className="h-3 w-3 rounded-full" />
          <ShimmerSkeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <ShimmerSkeleton className="h-3 w-3 rounded-full" />
          <ShimmerSkeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

/**
 * TableSkeleton - Loading state for data tables
 */
export function TableSkeleton({ 
  rows = 5,
  columns = 4,
  className 
}: { 
  rows?: number
  columns?: number
  className?: string 
}) {
  return (
    <div className={cn('p-6', className)}>
      {/* Table header */}
      <div className="flex items-center justify-between mb-6">
        <ShimmerSkeleton className="h-6 w-32" />
        <div className="flex gap-2">
          <ShimmerSkeleton className="h-8 w-20 rounded-lg" />
          <ShimmerSkeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      
      {/* Table */}
      <div className="space-y-3">
        {/* Header row */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }, (_, i) => (
            <ShimmerSkeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        
        {/* Separator */}
        <ShimmerSkeleton className="h-px w-full" />
        
        {/* Data rows */}
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div 
            key={rowIndex}
            className="grid gap-4" 
            style={{ 
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              animationDelay: `${rowIndex * 100}ms`
            }}
          >
            {Array.from({ length: columns }, (_, colIndex) => (
              <ShimmerSkeleton 
                key={colIndex} 
                className={cn(
                  'h-4',
                  // Vary widths for more realistic appearance
                  colIndex === 0 && 'w-24',
                  colIndex === 1 && 'w-16', 
                  colIndex === 2 && 'w-20',
                  colIndex >= 3 && 'w-14'
                )}
              />
            ))}
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <ShimmerSkeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <ShimmerSkeleton className="h-8 w-8 rounded" />
          <ShimmerSkeleton className="h-8 w-8 rounded" />
          <ShimmerSkeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * ListSkeleton - Loading state for simple lists
 */
export function ListSkeleton({ 
  items = 3,
  className 
}: { 
  items?: number
  className?: string 
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }, (_, i) => (
        <div 
          key={i} 
          className="flex items-center gap-3"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <ShimmerSkeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <ShimmerSkeleton className="h-4 w-full max-w-48" />
            <ShimmerSkeleton className="h-3 w-full max-w-32" />
          </div>
          <ShimmerSkeleton className="h-4 w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

/**
 * PageSkeleton - Full page loading state with navy glass cards
 */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-8', className)}>
      {/* Page header */}
      <div className="space-y-4">
        <ShimmerSkeleton className="h-8 w-64" />
        <ShimmerSkeleton className="h-4 w-96" />
      </div>
      
      {/* KPI cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPISkeleton />
        <KPISkeleton />
        <KPISkeleton />
        <KPISkeleton />
      </div>
      
      {/* Chart section */}
      <ChartSkeleton />
      
      {/* Table section */}
      <TableSkeleton />
    </div>
  )
}
