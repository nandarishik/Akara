import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import LiquidGlassCard from './LiquidGlassCard'
import AnimatedNumber from './AnimatedNumber'
import { createStagger } from '@/lib/springs'

interface GlowKPICardProps {
  /**
   * KPI title/label
   */
  title: string
  
  /**
   * Main KPI value to display
   */
  value: number
  
  /**
   * Change from previous period
   */
  change?: {
    value: number
    percentage: number
    period?: string  // e.g., "vs last month"
  }
  
  /**
   * Icon component (optional)
   */
  icon?: ReactNode
  
  /**
   * Number formatting options
   */
  format?: {
    style?: 'decimal' | 'currency' | 'percent'
    currency?: string
    minimumFractionDigits?: number
    maximumFractionDigits?: number
  }
  
  /**
   * Custom formatter function
   */
  formatter?: (value: number) => string
  
  /**
   * Loading state
   */
  loading?: boolean
  
  /**
   * Stagger delay for entrance animation
   */
  staggerIndex?: number
  
  /**
   * Additional CSS classes
   */
  className?: string
  
  /**
   * Click handler
   */
  onClick?: () => void
}

/**
 * DeltaBadge - Shows change indicator with appropriate colors
 */
function DeltaBadge({ 
  change, 
  className 
}: { 
  change: NonNullable<GlowKPICardProps['change']>
  className?: string 
}) {
  const isPositive = change.percentage > 0
  const isNeutral = change.percentage === 0
  
  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold animate-[pulseOnce_0.6s_ease-in-out_both]',
        isPositive && 'bg-green-500/10 text-green-400',
        isNeutral && 'bg-blue-500/10 text-blue-400', 
        !isPositive && !isNeutral && 'bg-red-500/10 text-red-400',
        className
      )}
      style={{
        animationDelay: '0.8s'  // Appears after the main content
      }}
    >
      {/* Arrow icon */}
      <span className="text-[10px]">
        {isPositive ? '↗' : isNeutral ? '→' : '↘'}
      </span>
      
      {/* Percentage */}
      <span>
        {isPositive ? '+' : ''}{change.percentage.toFixed(1)}%
      </span>
      
      {/* Period */}
      {change.period && (
        <span className="text-[#5C8FBF]">
          {change.period}
        </span>
      )}
    </div>
  )
}

/**
 * GlowKPICard - Premium KPI card for the AKARA Blue system
 * 
 * Features:
 * - Navy glass base with LiquidGlassCard
 * - Blue gradient left-bar accent (electric blue glow)
 * - AnimatedNumber count-up with easeOutExpo
 * - DeltaBadge with emerald ↗ or red ↘
 * - Staggered entrance animation
 * - Loading state with blue shimmer
 * - Hover glow effect
 * 
 * Usage:
 * ```tsx
 * <GlowKPICard
 *   title="Total Revenue"
 *   value={2847500}
 *   format={{ style: 'currency', currency: 'INR' }}
 *   change={{ value: 125000, percentage: 12.5, period: 'vs last month' }}
 *   staggerIndex={0}
 * />
 * ```
 */
export default function GlowKPICard({
  title,
  value,
  change,
  icon,
  format,
  formatter,
  loading = false,
  staggerIndex = 0,
  className,
  onClick,
}: GlowKPICardProps) {
  if (loading) {
    return (
      <LiquidGlassCard 
        className={cn('p-6', className)}
        hover={false}
      >
        {/* Loading skeleton */}
        <div className="space-y-4">
          <div className="skeleton h-4 w-24" />
          <div className="flex items-end gap-3">
            <div className="skeleton h-10 w-32" />
            <div className="skeleton h-6 w-16 mb-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton h-4 w-4 rounded-full" />
            <div className="skeleton h-4 w-20" />
          </div>
        </div>
      </LiquidGlassCard>
    )
  }

  return (
    <LiquidGlassCard 
      className={cn(
        'relative p-6 group',
        onClick && 'cursor-pointer',
        className
      )}
      hover={!!onClick}
      onClick={onClick}
      style={createStagger(staggerIndex)}
    >
      {/* Electric blue left-bar accent with glow */}
      <div 
        className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-[#42A5F5] opacity-80"
        style={{
          boxShadow: '0 0 8px rgba(66,165,245,0.6), 2px 0 12px rgba(66,165,245,0.3)',
        }}
      />
      
      {/* Content area with left padding for accent bar */}
      <div className="pl-6 space-y-4">
        {/* Header: title and optional icon */}
        <div className="flex items-center justify-between">
          <h4 className="text-[#90CAF9] text-sm font-medium leading-none">
            {title}
          </h4>
          {icon && (
            <div className="text-[#64B5F6] text-lg">
              {icon}
            </div>
          )}
        </div>
        
        {/* Main value with animated count-up */}
        <div className="space-y-2">
          <div className="kpi-value text-white">
            <AnimatedNumber
              value={value}
              format={format}
              formatter={formatter}
              delay={staggerIndex * 150 + 200} // Staggered delay
              className="text-3xl font-bold font-mono"
            />
          </div>
          
          {/* Change indicator */}
          {change && (
            <DeltaBadge 
              change={change}
            />
          )}
        </div>
      </div>
      
      {/* Hover glow enhancement */}
      {onClick && (
        <div 
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(66,165,245,0.03) 0%, rgba(0,188,212,0.03) 100%)',
            boxShadow: '0 0 20px rgba(66,165,245,0.1)',
          }}
        />
      )}
    </LiquidGlassCard>
  )
}

/**
 * KPIGrid - Container for multiple KPI cards with automatic staggering
 */
export function KPIGrid({ 
  children, 
  className 
}: { 
  children: ReactNode
  className?: string 
}) {
  return (
    <div className={cn(
      'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6',
      className
    )}>
      {children}
    </div>
  )
}

/**
 * Specialized KPI card variants
 */

/**
 * RevenueKPICard - For displaying revenue metrics
 */
export function RevenueKPICard(props: Omit<GlowKPICardProps, 'format' | 'icon'>) {
  return (
    <GlowKPICard
      {...props}
      format={{ style: 'currency', currency: 'INR', maximumFractionDigits: 0 }}
      icon="₹"
    />
  )
}

/**
 * CountKPICard - For displaying count metrics
 */
export function CountKPICard(props: Omit<GlowKPICardProps, 'format' | 'icon'>) {
  return (
    <GlowKPICard
      {...props}
      format={{ style: 'decimal', maximumFractionDigits: 0 }}
      icon="#"
    />
  )
}

/**
 * PercentageKPICard - For displaying percentage metrics
 */
export function PercentageKPICard(props: Omit<GlowKPICardProps, 'format' | 'icon'>) {
  return (
    <GlowKPICard
      {...props}
      format={{ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }}
      icon="%"
    />
  )
}
