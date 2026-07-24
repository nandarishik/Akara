/**
 * Springs - Motion system for the AKARA Blue UI
 * 
 * Contains spring configurations for Framer Motion and fallback CSS animations.
 * Will be upgraded to full framer-motion once dependencies are installed.
 */

// Framer Motion spring configurations (for when framer-motion is available)
export const springs = {
  // Snappy - Quick, responsive interactions (buttons, hover states)
  snappy: { type: "spring", stiffness: 500, damping: 30, mass: 0.5 } as const,
  
  // Gentle - Smooth, natural feeling (cards, modals)  
  gentle: { type: "spring", stiffness: 200, damping: 25, mass: 0.8 } as const,
  
  // Bouncy - Playful interactions (success states, notifications)
  bouncy: { type: "spring", stiffness: 300, damping: 15, mass: 0.6 } as const,
  
  // Smooth - Slow, elegant (page transitions, large elements)
  smooth: { type: "spring", stiffness: 100, damping: 20, mass: 1 } as const,
}

// Stagger timing for list animations
export const stagger = {
  fast: 0.03,    // Rapid-fire appearance
  normal: 0.06,  // Standard stagger
  slow: 0.1,     // Deliberate, one-by-one
}

// Easing functions for CSS animations
export const easing = {
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOutCubic: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOutCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
  bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

// Animation presets for common patterns
export const animations = {
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: springs.gentle,
  },
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: springs.snappy,
  },
  
  slideInRight: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
    transition: springs.gentle,
  },
}

/**
 * CSS Animation classes (fallback when framer-motion is not available)
 */
export const cssAnimations = {
  fadeInUp: 'animate-[fadeInUp_0.4s_cubic-bezier(0.33,1,0.68,1)_both]',
  scaleIn: 'animate-[scaleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]',
  slideInRight: 'animate-[slideInRight_0.4s_cubic-bezier(0.33,1,0.68,1)_both]',
  countUp: 'animate-[countUp_1.2s_cubic-bezier(0.16,1,0.3,1)_both]',
  pulse: 'animate-[pulseOnce_0.6s_ease-in-out_both]',
}

/**
 * Helper function to create staggered delays for CSS animations
 */
export function createStagger(index: number, delay: keyof typeof stagger = 'normal') {
  return {
    animationDelay: `${index * stagger[delay]}s`,
  }
}

/**
 * Utility to detect if framer-motion is available
 */
export function hasFramerMotion() {
  // For now, framer-motion is not available, use CSS fallbacks
  return false
}
