import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
// import { easing } from '@/lib/springs' // Unused for now

interface AnimatedNumberProps {
  /**
   * Target number to animate to
   */
  value: number
  
  /**
   * Optional starting value (default: 0)
   */
  from?: number
  
  /**
   * Animation duration in milliseconds (default: 1200)
   */
  duration?: number
  
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
   * CSS class overrides
   */
  className?: string
  
  /**
   * Delay before starting animation (ms)
   */
  delay?: number
  
  /**
   * Whether to trigger animation when value changes
   */
  animate?: boolean
}

/**
 * AnimatedNumber - Count-up animation component for the AKARA Blue system
 * 
 * Features:
 * - Smooth count-up animation using requestAnimationFrame
 * - easeOutExpo timing (slow start, fast finish)
 * - Respects user's reduced-motion preferences
 * - Handles currency, percentage, and custom formatting
 * - Triggers when value changes or component mounts
 * - Optimized for KPI cards and dashboard metrics
 * 
 * Usage:
 * ```tsx
 * <AnimatedNumber 
 *   value={42750} 
 *   format={{ style: 'currency', currency: 'INR' }}
 *   className="text-3xl font-bold text-white"
 * />
 * ```
 */
export default function AnimatedNumber({
  value,
  from = 0,
  duration = 1200,
  format,
  formatter,
  className,
  delay = 0,
  animate = true,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(animate ? from : value)
  const [isAnimating, setIsAnimating] = useState(false)
  const rafRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)
  const startValueRef = useRef<number>(from)

  // Format number using Intl.NumberFormat or custom formatter
  const formatNumber = (num: number): string => {
    if (formatter) {
      return formatter(num)
    }
    
    if (format) {
      return new Intl.NumberFormat('en-IN', {
        style: format.style || 'decimal',
        currency: format.currency || 'INR',
        minimumFractionDigits: format.minimumFractionDigits,
        maximumFractionDigits: format.maximumFractionDigits,
      }).format(num)
    }
    
    // Default formatting for Indian locale
    return new Intl.NumberFormat('en-IN').format(num)
  }

  // easeOutExpo function for smooth deceleration
  const easeOutExpo = (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
  }

  // Animation function
  const animateValue = (targetValue: number) => {
    if (!animate) {
      setDisplayValue(targetValue)
      return
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setDisplayValue(targetValue)
      return
    }

    setIsAnimating(true)
    const startValue = startValueRef.current
    const difference = targetValue - startValue
    
    const animationStep = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime
      }
      
      const elapsed = currentTime - startTimeRef.current - delay
      
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(animationStep)
        return
      }
      
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutExpo(progress)
      const currentValue = startValue + (difference * easedProgress)
      
      setDisplayValue(currentValue)
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animationStep)
      } else {
        setDisplayValue(targetValue)
        setIsAnimating(false)
        startTimeRef.current = undefined
      }
    }
    
    rafRef.current = requestAnimationFrame(animationStep)
  }

  // Trigger animation when value changes
  useEffect(() => {
    startValueRef.current = displayValue
    animateValue(value)
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <span 
      className={cn(
        'tabular-nums font-mono',
        isAnimating && 'animate-pulse',
        className
      )}
    >
      {formatNumber(displayValue)}
    </span>
  )
}

/**
 * Specialized AnimatedNumber variants for common use cases
 */

/**
 * CurrencyNumber - For displaying animated currency values
 */
export function CurrencyNumber({ 
  value, 
  currency = 'INR',
  className,
  ...props 
}: Omit<AnimatedNumberProps, 'format'> & { currency?: string }) {
  return (
    <AnimatedNumber
      value={value}
      format={{ style: 'currency', currency }}
      className={cn('text-green-400', className)}
      {...props}
    />
  )
}

/**
 * PercentageNumber - For displaying animated percentage values
 */
export function PercentageNumber({ 
  value, 
  className,
  ...props 
}: Omit<AnimatedNumberProps, 'format'>) {
  return (
    <AnimatedNumber
      value={value}
      format={{ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }}
      className={cn('text-blue-400', className)}
      {...props}
    />
  )
}

/**
 * CountNumber - For displaying simple count animations
 */
export function CountNumber({ 
  value, 
  className,
  ...props 
}: Omit<AnimatedNumberProps, 'format'>) {
  return (
    <AnimatedNumber
      value={value}
      format={{ style: 'decimal', maximumFractionDigits: 0 }}
      className={cn('text-white', className)}
      {...props}
    />
  )
}
