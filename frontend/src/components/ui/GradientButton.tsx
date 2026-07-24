import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

/**
 * GradientButton - The primary CTA button with AKARA Blue gradient
 * 
 * Features:
 * - Primary: Blue gradient from #1565C0 → #1E88E5 → #42A5F5
 * - Secondary: Outlined blue with glow hover effect
 * - Shine sweep effect on hover (primary)
 * - Scale animations: hover scale-[1.02], active scale-[0.98]
 * - Blue glow shadow on primary buttons
 * - Disabled states with proper opacity and cursor
 */
export default function GradientButton({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  className,
  disabled,
  ...props 
}: ButtonProps) {
  const baseClasses = cn(
    'relative inline-flex items-center justify-center gap-2 font-semibold',
    'transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
    'active:scale-[0.98]',
    
    // Size variants
    size === 'sm' && 'px-4 py-2 text-sm rounded-lg',
    size === 'md' && 'px-6 py-3 text-base rounded-xl',
    size === 'lg' && 'px-8 py-4 text-lg rounded-xl',
  )

  if (variant === 'primary') {
    return (
      <button
        className={cn(
          baseClasses,
          'text-white group',
          'hover:scale-[1.02]',
          'overflow-hidden',
          disabled || loading ? '' : 'hover:scale-[1.02]',
          className
        )}
        style={{
          background: 'linear-gradient(135deg, #1565C0 0%, #1E88E5 50%, #42A5F5 100%)',
          boxShadow: '0 4px 20px rgba(33,150,243,0.3)',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(66,165,245,0.5)'
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(33,150,243,0.3)'
          }
        }}
        disabled={disabled || loading}
        {...props}
      >
        {/* Shine effect on hover */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <div 
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)'
            }}
          />
        </div>
        
        {/* Content */}
        <span className="relative">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Loading...
            </div>
          ) : (
            children
          )}
        </span>
      </button>
    )
  }

  // Secondary Button - Outlined with blue glow hover
  return (
    <button
      className={cn(
        baseClasses,
        'bg-transparent border border-[rgba(33,150,243,0.3)]',
        'text-[#64B5F6]',
        'hover:bg-[rgba(33,150,243,0.08)] hover:border-[rgba(33,150,243,0.5)]',
        'hover:shadow-[0_0_16px_rgba(33,150,243,0.15)]',
        disabled || loading ? '' : 'hover:scale-[1.02]',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#64B5F6]/30 border-t-[#64B5F6] rounded-full animate-spin" />
          Loading...
        </div>
      ) : (
        children
      )}
    </button>
  )
}

/**
 * SecondaryButton - Convenience wrapper for secondary variant
 */
export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <GradientButton variant="secondary" {...props} />
}

/**
 * GhostButton - Subtle button for less prominent actions
 */
export function GhostButton({ children, className, ...props }: Omit<ButtonProps, 'variant'>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium',
        'bg-transparent text-[#90CAF9]',
        'hover:bg-[rgba(33,150,243,0.06)]',
        'active:scale-[0.98]',
        'transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
