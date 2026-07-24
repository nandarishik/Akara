'use client'

// Note: Will upgrade to framer-motion once dependencies are installed
// import { motion } from 'framer-motion'

/**
 * GradientMesh - The animated navy background component
 * 
 * Creates the deep navy canvas with drifting royal-blue and cyan orbs
 * that serves as the foundation for the AKARA Blue design system.
 * 
 * Features:
 * - Deep navy base (#020B18) - NOT pure black
 * - Top-right royal blue orb that drifts in 20s loops
 * - Bottom-left deep blue orb that drifts in 28s loops  
 * - Center cyan pulse that scales and fades in 8s loops
 * - Noise texture overlay for depth and grain
 * - Top gradient fade for nav area
 */
export default function GradientMesh() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base deep navy (NEVER pure black) */}
      <div className="absolute inset-0" style={{ backgroundColor: '#020B18' }} />
      
      {/* Top-right: royal blue orb (like moonlight on ocean) */}
      <div
        className="absolute -top-32 -right-16 w-[700px] h-[700px] rounded-full blur-[150px] opacity-15 animate-[drift1_20s_linear_infinite]"
        style={{
          backgroundColor: '#1565C0',
        }}
      />
      
      {/* Bottom-left: deep blue glow */}
      <div
        className="absolute -bottom-20 -left-20 w-[600px] h-[600px] rounded-full blur-[130px] opacity-20 animate-[drift2_28s_linear_infinite]"
        style={{
          backgroundColor: '#0F3460',
        }}
      />
      
      {/* Center: subtle cyan pulse (life) */}
      <div
        className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[100px] animate-[pulse_8s_ease-in-out_infinite]"
        style={{
          backgroundColor: '#00BCD4',
          opacity: 0.05,
        }}
      />
      
      {/* Noise texture for depth and grain */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E")'
        }}
      />
      
      {/* Top gradient fade (for the nav area) */}
      <div 
        className="absolute top-0 inset-x-0 h-32"
        style={{
          background: 'linear-gradient(to bottom, #020B18, transparent)'
        }}
      />
    </div>
  )
}
