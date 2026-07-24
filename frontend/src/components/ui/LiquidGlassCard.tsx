import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface LiquidGlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  style?: React.CSSProperties
  /**
   * Additional glass effects
   */
  variant?: 'default' | 'glow' | 'subtle'
}

/**
 * LiquidGlassCard - The universal card container for the AKARA Blue system
 * 
 * Features:
 * - Navy glass background (rgba(15,52,96,0.4)) - NOT pure transparent
 * - Blue-tinted borders (rgba(33,150,243,0.12))
 * - backdrop-blur-2xl for glassmorphism effect
 * - Hover states with increased opacity and blue glow shadow
 * - Inner blue gradient shine effect on hover
 * 
 * Usage:
 * - Used on EVERY card in the app (KPIs, charts, tables, slots)
 * - Replace all existing white/gray card backgrounds
 * - Foundation for GlowKPICard, slot cards, etc.
 */
export default function LiquidGlassCard({ 
  children, 
  className,
  hover = true,
  onClick,
  style,
  variant = 'default'
}: LiquidGlassCardProps) {
  return (
    <div 
      onClick={onClick}
      style={style}
      className={cn(
        // Base navy glass styling
        'relative overflow-hidden rounded-2xl',
        'border backdrop-blur-2xl',
        'transition-all duration-200',
        
        // Navy glass background and border
        'border-[rgba(33,150,243,0.12)]',
        
        // Variant-specific backgrounds
        variant === 'default' && 'bg-[rgba(15,52,96,0.4)]',
        variant === 'glow' && 'bg-[rgba(15,52,96,0.5)]',
        variant === 'subtle' && 'bg-[rgba(15,52,96,0.3)]',
        
        // Shadow - deep navy base
        'shadow-[0_8px_32px_rgba(2,11,24,0.6)]',
        
        // Hover effects
        hover && [
          'group cursor-pointer',
          'hover:bg-[rgba(15,52,96,0.55)] hover:border-[rgba(33,150,243,0.2)]',
          'hover:shadow-[0_12px_40px_rgba(2,11,24,0.8),0_0_20px_rgba(33,150,243,0.08)]'
        ],
        
        className
      )}
    >
      {/* Inner blue gradient glow on hover */}
      {hover && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
             style={{
               background: 'linear-gradient(135deg, rgba(66,165,245,0.05) 0%, transparent 50%, rgba(0,188,212,0.05) 100%)'
             }} />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

/**
 * Specialized variants for common use cases
 */
export function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <LiquidGlassCard variant="subtle" hover={false} className={cn('p-6', className)}>
      {children}
    </LiquidGlassCard>
  )
}

export function InteractiveGlassCard({ children, className, onClick }: { 
  children: ReactNode
  className?: string
  onClick?: () => void 
}) {
  return (
    <LiquidGlassCard 
      variant="glow" 
      hover={true} 
      className={cn('p-6 cursor-pointer', className)}
      {...(onClick && { onClick })}
    >
      {children}
    </LiquidGlassCard>
  )
}
