import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import GradientButton, { SecondaryButton } from './GradientButton'

interface EmptyStateProps {
  /**
   * Icon component - usually from lucide-react
   * Should be sized w-16 h-16 for best visual balance
   */
  icon: ReactNode
  
  /**
   * Main heading text - will be rendered with blue gradient
   */
  title: string
  
  /**
   * Descriptive text - rendered in muted blue
   */
  description?: string
  
  /**
   * Primary action button
   */
  primaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
  
  /**
   * Secondary action button (optional)
   */
  secondaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
  
  /**
   * Custom content below buttons
   */
  children?: ReactNode
  
  className?: string
}

/**
 * EmptyState - Beautiful empty states for the AKARA Blue system
 * 
 * Features:
 * - Blue gradient glow behind icon (from-[#1565C0]/20 to-[#42A5F5]/20)
 * - Gradient text heading (from-[#42A5F5] to-[#80D8FF])
 * - Muted blue description text (#5C8FBF)  
 * - GradientButton for primary CTA
 * - SecondaryButton for optional secondary action
 * - Staggered entrance animation
 * - Centered layout optimized for empty dashboard/page states
 * 
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={<BarChart3 className="w-16 h-16 text-[#64B5F6]" />}
 *   title="Your dashboard is empty"
 *   description="Import your first sales file to see live KPIs."
 *   primaryAction={{ label: "Import first file", href: "/data" }}
 *   secondaryAction={{ label: "Use sample data", onClick: handleSample }}
 * />
 * ```
 */
export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Icon with blue gradient glow behind it */}
        <div className="relative inline-block">
          {/* Background glow effect */}
          <div 
            className="absolute inset-0 -m-6 rounded-full blur-3xl opacity-40"
            style={{
              background: 'radial-gradient(circle, rgba(21,101,192,0.2) 0%, rgba(66,165,245,0.2) 100%)'
            }}
          />
          
          {/* Icon */}
          <div className="relative">
            {icon}
          </div>
        </div>
        
        {/* Heading with blue gradient text */}
        <div className="space-y-3">
          <h3 
            className="text-2xl font-bold bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #42A5F5 0%, #80D8FF 100%)'
            }}
          >
            {title}
          </h3>
          
          {/* Description in muted blue */}
          {description && (
            <p className="text-[#5C8FBF] leading-relaxed">
              {description}
            </p>
          )}
        </div>
        
        {/* Action buttons */}
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {primaryAction && (
              <GradientButton
                onClick={primaryAction.onClick}
                {...(primaryAction.href && { 
                  as: 'a', 
                  href: primaryAction.href 
                })}
              >
                {primaryAction.label}
              </GradientButton>
            )}
            
            {secondaryAction && (
              <SecondaryButton
                onClick={secondaryAction.onClick}
                {...(secondaryAction.href && { 
                  as: 'a', 
                  href: secondaryAction.href 
                })}
              >
                {secondaryAction.label}
              </SecondaryButton>
            )}
          </div>
        )}
        
        {/* Custom content */}
        {children}
      </div>
    </div>
  )
}

/**
 * Specialized empty states for common use cases
 */

/**
 * DashboardEmptyState - For empty dashboard
 */
export function DashboardEmptyState() {
  return (
    <EmptyState
      icon={<div className="w-16 h-16 text-[#64B5F6] flex items-center justify-center text-3xl">📊</div>}
      title="Your dashboard awaits data"
      description="Import your first sales file to unlock powerful insights and live KPIs."
      primaryAction={{ label: "Import Data", href: "/data" }}
      secondaryAction={{ label: "Try Sample Data", onClick: () => console.log('Sample data') }}
    />
  )
}

/**
 * CopilotEmptyState - For empty copilot chat
 */
export function CopilotEmptyState() {
  return (
    <EmptyState
      icon={<div className="w-16 h-16 text-[#64B5F6] flex items-center justify-center text-3xl">✦</div>}
      title="Ask AKARA anything"
      description="Your AI copilot is ready to analyze data, answer questions, and provide insights."
      primaryAction={{ label: "Start Conversation", onClick: () => console.log('Start chat') }}
    >
      {/* Suggested prompts */}
      <div className="mt-6 space-y-2">
        <p className="text-sm text-[#5C8FBF] mb-3">Try asking:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            "Show me top routes by revenue",
            "Which parties are outstanding?",
            "Monthly sales trend analysis"
          ].map((prompt) => (
            <button
              key={prompt}
              className="px-3 py-2 text-sm border border-[rgba(33,150,243,0.3)] rounded-lg text-[#90CAF9] hover:bg-[rgba(33,150,243,0.08)] transition-colors"
              onClick={() => console.log(`Send prompt: ${prompt}`)}
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>
    </EmptyState>
  )
}

/**
 * NoDataEmptyState - Generic no data state
 */
export function NoDataEmptyState({ 
  title = "No data available", 
  description = "There's nothing to show here yet.",
  actionLabel = "Refresh",
  onAction
}: {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <EmptyState
      icon={<div className="w-16 h-16 text-[#64B5F6] flex items-center justify-center text-3xl">📭</div>}
      title={title}
      description={description}
      {...(onAction && {
        primaryAction: { label: actionLabel, onClick: onAction }
      })}
    />
  )
}
