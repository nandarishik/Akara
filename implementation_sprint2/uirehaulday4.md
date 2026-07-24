# AKARA UI Rehaul — Day 4 Design Specification

> ## 🔵 THE BLUE MANIFESTO
> 
> **THE ENTIRE APP LIVES IN BLUE.** Navy to electric blue transitions everywhere.
> Inspired directly by FireAI's deep navy → light blue gradient aesthetic.
> 
> - **NO pure blacks** — darkest color is `#020B18` (blue-black)
> - **NO pure grays** — every neutral is blue-tinted
> - **NO violet/purple** — the accent color is electric blue `#42A5F5`
> - **Backgrounds**: Deep navy gradients (`#020B18` → `#0F3460` → `#1976D2`)
> - **Cards/Panels**: Blue-tinted glass (`rgba(15,52,96,0.4)`)
> - **Borders**: Blue-tinted (`rgba(33,150,243,0.12)`)
> - **Text**: White for headings, light blue (`#90CAF9`) for body, muted blue (`#5C8FBF`) for captions
> - **Buttons**: Blue gradient CTAs (`#1565C0` → `#42A5F5`)
> - **Hover/Glow**: Electric blue glow (`rgba(66,165,245,0.35)`)
> 
> Reference: The FireAI compliance section screenshot — that exact deep navy background with blue glass cards. That's AKARA.

## Design Philosophy

AKARA must feel like a **premium intelligence product**, not a generic dashboard. Every pixel must communicate: "This tool makes you money."

The design draws from the best SaaS products of 2026:
- **FireAI**: Deep navy → electric blue gradients, trust sections on navy glass ← **PRIMARY INSPIRATION**
- **Linear**: Extreme restraint, single accent, buttery 120ms animations
- **Stripe**: Flowing gradients, precision typography, financial-grade polish
- **Vercel**: Monochrome discipline, generous whitespace, engineering clarity
- **Doppler/GlowStack**: Dark glassmorphism for data-dense operational views

### The Blue Spectrum — Three Depths

| Surface | Blue Depth | Mood |
|---|---|---|
| Public (Landing, Auth) | Light blue → Navy hero gradient (like FireAI) | "Wow, this looks expensive" |
| Customer App (Dashboard, Copilot, Data) | Deep navy + electric blue glass | "I'm using something powerful" |
| Superadmin (Ops Center) | Near-black navy + cyan accents | "I control everything" |

> **Rule: NO pure grays or pure blacks anywhere.** Every neutral surface has a blue undertone. Gray-50 becomes Blue-50. Gray-900 becomes Navy-900. The entire app lives in the blue universe.

---

## 1. Color System — The AKARA Blue

> **The blue.** Deep navy at the bottom. Electric cyan at the top. Like looking into the ocean from above. This is AKARA's identity — intelligence, depth, trust.

### 1.1 Primary Gradient (The Hero Blue — Used EVERYWHERE)

```css
/* THE signature gradient — deep navy → royal blue → electric blue */
--gradient-brand: linear-gradient(135deg, #0A1628 0%, #0F3460 30%, #1A56DB 60%, #2E86DE 100%);
--gradient-brand-vivid: linear-gradient(135deg, #0C2D57 0%, #1565C0 40%, #42A5F5 100%);
--gradient-brand-light: linear-gradient(135deg, #1565C0 0%, #42A5F5 50%, #80D8FF 100%);

/* The flowing hero background (like FireAI) */
--gradient-hero: linear-gradient(180deg, #020B18 0%, #0A1F3D 20%, #0F3460 50%, #1976D2 85%, #42A5F5 100%);

/* Card/section backgrounds — blue-tinted dark, not pure black */
--gradient-section: linear-gradient(180deg, #040D1A 0%, #0A1F3D 100%);

/* Button gradient — electric and clickable */
--gradient-button: linear-gradient(135deg, #1565C0 0%, #1E88E5 50%, #42A5F5 100%);
--gradient-button-hover: linear-gradient(135deg, #1976D2 0%, #2196F3 50%, #64B5F6 100%);

/* Subtle gradient for cards on dark blue backgrounds */
--gradient-card: linear-gradient(135deg, rgba(15, 52, 96, 0.6) 0%, rgba(26, 86, 219, 0.15) 100%);
```

### 1.2 The Blue Scale (10 shades from abyss to sky)

```css
/* Use these everywhere — NOT generic grays */
--blue-950: #020B18;   /* The abyss — deepest background */
--blue-900: #051B37;   /* Deep navy — page canvas */
--blue-850: #0A1F3D;   /* Navy — card backgrounds */
--blue-800: #0C2D57;   /* Dark blue — elevated surfaces */
--blue-700: #0F3460;   /* Mid-navy — sidebar, panels */
--blue-600: #1565C0;   /* Royal blue — borders, dividers */
--blue-500: #1976D2;   /* Primary blue — interactive elements */
--blue-400: #2196F3;   /* Bright blue — active states */
--blue-300: #42A5F5;   /* Electric blue — accents, CTAs */
--blue-200: #64B5F6;   /* Light blue — highlights */
--blue-100: #90CAF9;   /* Sky blue — subtle text on dark */
--blue-50:  #E3F2FD;   /* Ice blue — badges on light */
```

### 1.3 Surface System (Dark Blue Mode — THE Entire App)

```css
/* Canvas — deep navy, NOT pure black. Blue-tinted. */
--surface-void: #020B18;           /* Deepest background (blue-black) */
--surface-base: #051B37;           /* Page-level canvas */
--surface-raised: #0A1F3D;         /* Cards, panels */
--surface-elevated: #0C2D57;       /* Hover states, active items */
--surface-overlay: #0F3460;        /* Dropdowns, modals */

/* Glass panels — blue-tinted translucency */
--glass-bg: rgba(15, 52, 96, 0.4);
--glass-border: rgba(33, 150, 243, 0.12);
--glass-hover: rgba(33, 150, 243, 0.18);
--glass-active: rgba(33, 150, 243, 0.25);
```

### 1.4 Accent Colors (On Blue Backgrounds)

```css
/* Primary accent — electric blue (the highlight) */
--accent-primary: #42A5F5;
--accent-primary-glow: rgba(66, 165, 245, 0.35);
--accent-primary-subtle: rgba(66, 165, 245, 0.12);

/* Secondary accent — cyan (for data, charts, AI) */
--accent-cyan: #00BCD4;
--accent-cyan-glow: rgba(0, 188, 212, 0.3);

/* Semantic colors — vibrant against navy */
--accent-success: #00E676;    /* Neon green — money, growth, passed */
--accent-warning: #FFB300;    /* Warm amber — attention needed */
--accent-danger: #FF5252;     /* Vibrant red — critical */
--accent-info: #80D8FF;       /* Light cyan — informational */

/* Chart palette (all pop beautifully on navy) */
--chart-1: #42A5F5;  /* Electric blue */
--chart-2: #00BCD4;  /* Cyan */
--chart-3: #00E676;  /* Neon green */
--chart-4: #FFB300;  /* Amber */
--chart-5: #FF80AB;  /* Pink */
--chart-6: #B388FF;  /* Lavender */
--chart-7: #80D8FF;  /* Ice blue */
```

### 1.5 Text Colors (On Blue Surfaces)

```css
/* Text on navy backgrounds */
--text-primary: #FFFFFF;           /* White — headings, values */
--text-secondary: #90CAF9;        /* Light blue — body text */
--text-muted: #5C8FBF;            /* Muted blue — labels, captions */
--text-faint: #2A5A8A;            /* Very muted — disabled, placeholders */
--text-link: #64B5F6;             /* Link blue — interactive text */
--text-link-hover: #90CAF9;       /* Link hover — lighter */
```

### 1.6 The Landing Page Gradient (Light Blue World)

```css
/* Public pages use the LIGHTER end of the blue spectrum */
--light-canvas: #FAFCFF;              /* Almost white with blue tint */
--light-card: #FFFFFF;
--light-card-blue: rgba(21, 101, 192, 0.03);  /* Cards with blue whisper */
--light-border: rgba(21, 101, 192, 0.08);
--light-text-primary: #0A1628;        /* Deep navy for text */
--light-text-secondary: #37474F;
--light-text-muted: #78909C;

/* Hero section uses the full gradient (like FireAI) */
--hero-bg: linear-gradient(180deg, #020B18 0%, #0F3460 50%, #1976D2 100%);
```

---

## 2. Typography — Precision at Every Scale

### 2.1 Font Stack

```css
/* Display — headlines that demand attention */
--font-display: 'Plus Jakarta Sans', system-ui, sans-serif;

/* Body — clean readability */
--font-body: 'Inter', system-ui, sans-serif;

/* Mono — numbers, code, data (tabular figures) */
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;
```

### 2.2 Type Scale

| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | 56px | 800 | -2.5px | Landing hero H1 |
| `display-lg` | 40px | 700 | -1.5px | Page hero titles |
| `display-md` | 32px | 700 | -1.0px | Section headers |
| `heading-lg` | 24px | 600 | -0.5px | Card titles, dashboard headers |
| `heading-md` | 20px | 600 | -0.3px | Sub-headers |
| `heading-sm` | 16px | 600 | -0.2px | Widget titles |
| `body-lg` | 16px | 400 | 0 | Primary body text |
| `body-md` | 14px | 400 | 0 | Secondary text, descriptions |
| `body-sm` | 12px | 400 | 0.2px | Captions, labels |
| `mono-lg` | 24px | 500 | -0.5px | KPI values, large numbers |
| `mono-md` | 14px | 400 | 0 | Table data, metrics |
| `mono-sm` | 11px | 400 | 0.5px | Timestamps, IDs |

### 2.3 Number Display (Financial Grade)

```css
/* All numbers use tabular figures for alignment */
.number {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1, "ss01" 1;
  font-variant-numeric: tabular-nums;
}

/* Large KPI values get the "pop" animation */
.kpi-value {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -1px;
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 3. Motion System — Spring Physics, Not Linear

### 3.1 Core Principles

1. **Enter fast, exit faster** — things appear with deceleration, disappear with acceleration
2. **Never animate layout properties** — only `transform` and `opacity`
3. **Under 150ms** for interactive feedback, 300ms for view transitions
4. **Spring physics** — natural bounce, not robotic linear movement

### 3.2 Animation Tokens

```typescript
// framer-motion spring configurations
export const springs = {
  // Snappy — buttons, toggles, hovers
  snappy: { type: "spring", stiffness: 500, damping: 30, mass: 0.5 },
  
  // Gentle — cards appearing, panels sliding
  gentle: { type: "spring", stiffness: 200, damping: 25, mass: 0.8 },
  
  // Bouncy — success states, confetti, celebrations
  bouncy: { type: "spring", stiffness: 300, damping: 15, mass: 0.6 },
  
  // Smooth — page transitions, large movements
  smooth: { type: "spring", stiffness: 100, damping: 20, mass: 1 },
}

// Duration-based (for opacity fades)
export const durations = {
  instant: 0.06,    // Hover highlights
  fast: 0.12,       // Button press, toggle
  normal: 0.2,      // Card appear
  slow: 0.35,       // Page transition
  glacial: 0.6,     // Hero entrance on landing
}

// Stagger delays for lists
export const stagger = {
  fast: 0.03,       // Table rows
  normal: 0.05,     // Card grid
  slow: 0.08,       // Landing page sections
}
```

### 3.3 Standard Animations

```typescript
// Fade up (default entrance)
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: springs.gentle,
}

// Scale in (modals, popovers)
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: springs.snappy,
}

// Slide from left (sidebar, drawers)
export const slideLeft = {
  initial: { x: -280, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: springs.smooth,
}

// Number tick (KPI counters)
export const numberTick = {
  // Counts from 0 to target value over 800ms
  // Uses easeOutExpo curve
  duration: 0.8,
  ease: [0.16, 1, 0.3, 1],
}

// Shimmer (skeleton loading)
export const shimmer = {
  backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
}
```

---

## 4. Component Library — Mesmerizing Primitives

### 4.1 Liquid Glass Card

The foundational container for every data surface. Blue-tinted glass on navy.

```tsx
// LiquidGlassCard.tsx
<div className={cn(
  "relative overflow-hidden rounded-2xl group",
  "bg-[rgba(15,52,96,0.4)] border border-[rgba(33,150,243,0.12)]",
  "backdrop-blur-2xl",
  "shadow-[0_8px_32px_rgba(2,11,24,0.6)]",
  "transition-all duration-200",
  "hover:bg-[rgba(15,52,96,0.55)] hover:border-[rgba(33,150,243,0.2)]",
  "hover:shadow-[0_12px_40px_rgba(2,11,24,0.8),0_0_20px_rgba(33,150,243,0.08)]",
)}>
  {/* Internal blue gradient glow on hover */}
  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-transparent to-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  
  {/* Content */}
  <div className="relative z-10 p-6">
    {children}
  </div>
</div>
```

### 4.2 Glow KPI Card

KPI cards with blue-glow accents on navy glass.

```tsx
// GlowKPICard.tsx — blue-glass card with accent glow
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={springs.gentle}
  className={cn(
    "relative overflow-hidden rounded-2xl p-6",
    "bg-[rgba(10,31,61,0.6)] border border-[rgba(33,150,243,0.12)]",
    "backdrop-blur-xl group cursor-default",
  )}
>
  {/* Accent glow bar — left side (blue gradient) */}
  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b from-[#42A5F5] via-[#1976D2] to-[#0F3460]" />
  
  {/* Floating blue glow on hover */}
  <div className={cn(
    "absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100",
    "bg-gradient-to-r from-[#1565C0]/20 via-[#42A5F5]/10 to-transparent",
    "transition-opacity duration-300",
    "blur-xl -z-10",
  )} />
  
  {/* Title */}
  <p className="text-xs font-medium text-[#90CAF9]/70 uppercase tracking-wider">
    {title}
  </p>
  
  {/* Value with number animation */}
  <AnimatedNumber
    value={value}
    className="mt-2 text-3xl font-semibold tracking-tight text-white font-mono"
    format={formatINR}
  />
  
  {/* Delta badge */}
  <DeltaBadge value={delta} className="mt-2" />
</motion.div>
```

### 4.3 Gradient Mesh Background

The animated background — deep ocean blues drifting like underwater currents.

```tsx
// GradientMesh.tsx — the navy-to-blue canvas that makes everything feel premium
<div className="fixed inset-0 -z-10 overflow-hidden">
  {/* Base deep navy (NEVER pure black) */}
  <div className="absolute inset-0 bg-[#020B18]" />
  
  {/* Top-right: royal blue orb (like moonlight on ocean) */}
  <motion.div
    animate={{
      x: [0, 40, -30, 0],
      y: [0, -30, 40, 0],
    }}
    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    className="absolute top-[-15%] right-[-5%] w-[700px] h-[700px] rounded-full bg-[#1565C0]/15 blur-[150px]"
  />
  
  {/* Bottom-left: deep blue glow */}
  <motion.div
    animate={{
      x: [0, -40, 30, 0],
      y: [0, 40, -30, 0],
    }}
    transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
    className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#0F3460]/20 blur-[130px]"
  />
  
  {/* Center: subtle cyan pulse (life) */}
  <motion.div
    animate={{
      scale: [1, 1.1, 1],
      opacity: [0.05, 0.1, 0.05],
    }}
    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#00BCD4]/8 blur-[100px]"
  />
  
  {/* Noise texture for depth and grain */}
  <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.015]" />
  
  {/* Top gradient fade (for the nav area) */}
  <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#020B18] to-transparent" />
</div>
```

### 4.4 Shimmer Skeleton

Loading states that shimmer with blue light on navy.

```tsx
// ShimmerSkeleton.tsx — blue-tinted shimmer on navy glass
<div className="relative overflow-hidden rounded-xl bg-[rgba(10,31,61,0.5)] border border-[rgba(33,150,243,0.08)]">
  {/* Blue shimmer sweep */}
  <div className="animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[rgba(33,150,243,0.08)] to-transparent" />
  <div className="p-6 space-y-4">
    <div className="h-4 w-1/3 rounded-md bg-[rgba(21,101,192,0.15)]" />
    <div className="h-8 w-2/3 rounded-md bg-[rgba(21,101,192,0.1)]" />
    <div className="h-3 w-1/2 rounded-md bg-[rgba(21,101,192,0.08)]" />
  </div>
</div>

// Tailwind keyframe (add to tailwind.config.ts)
// shimmer: { '100%': { transform: 'translateX(100%)' } }
```

### 4.5 Gradient Button

```tsx
// GradientButton.tsx — the primary CTA: deep blue → electric blue
<button className={cn(
  "relative inline-flex items-center justify-center gap-2 group",
  "rounded-xl px-6 py-3 font-semibold text-white",
  "bg-gradient-to-r from-[#1565C0] via-[#1E88E5] to-[#42A5F5]",
  "shadow-[0_4px_20px_rgba(33,150,243,0.3)]",
  "hover:shadow-[0_6px_28px_rgba(66,165,245,0.5)]",
  "hover:scale-[1.02]",
  "active:scale-[0.98]",
  "transition-all duration-150",
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
)}>
  {/* Shine sweep effect on hover */}
  <div className="absolute inset-0 rounded-xl overflow-hidden">
    <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700" />
  </div>
  <span className="relative">{children}</span>
</button>

// SecondaryButton — outlined with blue glow
<button className={cn(
  "relative inline-flex items-center justify-center gap-2",
  "rounded-xl px-6 py-3 font-semibold",
  "text-[#64B5F6] border border-[rgba(33,150,243,0.3)]",
  "bg-transparent",
  "hover:bg-[rgba(33,150,243,0.08)] hover:border-[rgba(33,150,243,0.5)]",
  "hover:shadow-[0_0_16px_rgba(33,150,243,0.15)]",
  "active:scale-[0.98]",
  "transition-all duration-150",
)}>
  {children}
</button>
```

### 4.6 Animated Charts

```tsx
// AreaChart with BLUE gradient fill and glow on navy background
<ResponsiveContainer>
  <AreaChart data={data}>
    <defs>
      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#42A5F5" stopOpacity={0.4} />
        <stop offset="50%" stopColor="#1976D2" stopOpacity={0.15} />
        <stop offset="100%" stopColor="#0F3460" stopOpacity={0} />
      </linearGradient>
      {/* Blue glow filter */}
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <Area
      type="monotone"
      stroke="#42A5F5"
      strokeWidth={2}
      fill="url(#chartGradient)"
      filter="url(#glow)"
      animationDuration={1200}
      animationEasing="ease-out"
    />
    {/* Custom tooltip with navy glass */}
    <Tooltip content={<GlassTooltip />} />
  </AreaChart>
</ResponsiveContainer>
```

---

## 5. Page-Level Transformations

### 5.1 Dashboard — "Mission Control"

**Current state:** Basic KPI cards on white background. Functional but lifeless.
**Target state:** A dark, alive command center where data feels electric.

#### Layout

```
┌────────────────────────────────────────────────────┐
│  [Logo]  Dashboard    [Date Picker▾]   [⚡ Alert]  │  ← Frosted glass top bar
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                │  ← 4 Glow KPI cards
│  │ ₹42L│ │₹5.8K│ │  47 │ │₹4.2L│                │     (staggered entrance)
│  │  ↑8%│ │  ↓3%│ │     │ │  ⚠️ │                │
│  └─────┘ └─────┘ └─────┘ └─────┘                │
│                                                    │
│  ┌──────────────────┐ ┌──────────────┐           │  ← Liquid glass charts
│  │ Revenue Trend    │ │ Zone Mix     │           │     (draw-in animation)
│  │ ▁▂▃▄▅▆▇█       │ │  ████        │           │
│  │              glow│ │  ██          │           │
│  └──────────────────┘ └──────────────┘           │
│                                                    │
│  ┌──────────────────────────────────────┐        │  ← Outstanding dues table
│  │ Outstanding · 6 parties · ₹4.2L     │        │     (red glow pulse)
│  │ ─────────────────────────────────── │        │
│  │ Sharma Traders  │ ₹1.2L │ [📱 WA]  │        │
│  └──────────────────────────────────────┘        │
│                                                    │
│  ┌─ Slot D ─────────────────────────────┐        │  ← Gradient border card
│  │ 💬 Ask your first question           │        │     (animated pulse)
│  │ [Ask now →]               [×]        │        │
│  └──────────────────────────────────────┘        │
└────────────────────────────────────────────────────┘
```

#### Key Visual Treatments

1. **KPI Cards**: Liquid glass with colored left-border glow. Numbers animate from 0 using `AnimatedNumber` (count-up with easeOutExpo). Delta badges pulse once on load.

2. **Charts**: Gradient fills with soft glow filter. Lines draw themselves in over 1.2s. Tooltips are frosted glass with backdrop-blur.

3. **Stale Data Banner**: Pulsing amber glow border. Urgency escalates visually (amber → orange → red) based on days since last import.

4. **Empty State**: Full-screen centered illustration with floating particles and gradient text. Two CTAs with magnetic hover effect.

5. **Background**: The `GradientMesh` component — deep navy canvas with drifting royal-blue and cyan orbs. Every surface is blue-tinted, not gray.

---

### 5.2 Copilot — "AI Conversation Studio"

**Current state:** Basic chat bubbles, no personality.
**Target state:** A futuristic AI conversation interface that makes users feel like they're talking to something intelligent.

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│ [≡ Conversations]                        Copilot        [quota] │
├─────────┬───────────────────────────────────────────────────────┤
│         │                                                       │
│ Recent  │   ┌─ AI Avatar ─────────────────────────────────┐   │
│ ─────── │   │ ✦                                           │   │
│ ● Zone..│   │ Your top zone last month was North         │   │
│   3m ago│   │ with ₹12.4L revenue (↑18% vs prev)        │   │
│ ○ Reven.│   │                                           │   │
│   1d ago│   │ ───────────────────────────────────────── │   │
│ ○ Top p.│   │ 📊 Based on 4,010 rows · Jan–Dec 2025    │   │
│   3d ago│   │ [👍] [👎]                                 │   │
│         │   └────────────────────────────────────────────┘   │
│         │                                                       │
│         │           ┌─ User ──────────────────┐                │
│         │           │ Which zone had highest   │                │
│         │           │ revenue last month?      │                │
│         │           └──────────────────────────┘                │
│         │                                                       │
│         ├───────────────────────────────────────────────────────│
│         │ [💬 Ask AKARA anything...              ] [↑ Send]    │
│         │                                                       │
│         │ Suggested:                                            │
│         │ [Revenue last month] [Top products] [Zone comparison]│
└─────────┴───────────────────────────────────────────────────────┘
```

#### Visual Treatments

1. **AI Response Bubbles**: Navy glass card (`bg-[rgba(10,31,61,0.6)]`) with electric blue left-border glow (`border-l-2 border-[#42A5F5]`). Text streams in word-by-word with a blinking cursor `▋`.

2. **User Messages**: Blue gradient background (`from-[#1565C0] to-[#1E88E5]`), slight rounded corners, float to right. White text.

3. **Suggested Prompts**: Pill-shaped chips with blue gradient borders. On hover: fill with blue gradient + scale-[1.03]. Border: `border-[rgba(33,150,243,0.3)]`, hover: `bg-[rgba(33,150,243,0.12)]`.

4. **Provenance Footer**: `text-[#5C8FBF]` monospace text below AI response. Gives the answer weight and trust.

5. **Feedback Buttons**: Appear with fade-in 500ms after response completes. On thumb-up: fills electric blue with a burst animation. On thumb-down: expands smoothly into a feedback form.

6. **Streaming State**: The input field shows a blue gradient pulse border during streaming (`border-[#42A5F5]` pulsing). The AI avatar (✦) gently rotates.

7. **Error State (503)**: The AI bubble has a soft red glow border instead of blue. Tone is apologetic but confident.

8. **Quota Exceeded**: Amber-bordered card with soft amber glow. Clear upgrade CTA with blue gradient button.

9. **Conversation Sidebar**: Deep navy glass panel (`bg-[#051B37]`). Active conversation has an electric blue left border with glow effect. Items fade in staggered.

---

### 5.3 Data Page — "Import Command Center"

**Target aesthetic:** A drag-drop interface that makes uploading data feel like feeding a machine.

#### Upload Zone States

1. **Idle**: Dashed border with blue gradient animation (border color cycles navy → electric blue → navy over 3s via `border-[rgba(33,150,243,0.4)]`). Floating upload icon with gentle bob animation.

2. **Drag Over**: Border becomes solid blue gradient. Background pulses with blue glow (`shadow-[0_0_40px_rgba(33,150,243,0.2)]`). Scale-[1.01]. Text changes to "Drop to upload ✨"

3. **Uploading**: Full blue gradient progress bar (`from-[#1565C0] to-[#42A5F5]`) that shimmers. Percentage counter ticks up. Pulsing blue orb in the center.

4. **Processing (Async)**: A "neural network" style animation — dots connecting with lines in electric blue, representing data being parsed. Status text: "Analysing 12,847 rows..."

5. **Success**: Burst animation (blue particles explode outward from center). Green checkmark fades in with bounce. Stats appear with staggered count-up.

6. **Error**: Shake animation (subtle 2px horizontal wobble × 3). Red glow pulse. Error text with retry button.

#### Import History Table

Dark glass panel with:
- Rows that fade in staggered
- Status dots that pulse (green=success, amber=processing, red=failed)
- Undo button with red glow on hover and confirmation modal with glassmorphism backdrop

---

### 5.4 Reports — "Intelligence Station"

#### Scheme Leakage (Business Plan Gate)

**Free users see:**
A stunning full-page gate that makes them WANT to upgrade:
- Blurred data preview behind a frosted navy glass overlay (`bg-[rgba(5,27,55,0.85)] backdrop-blur-lg`)
- Large lock icon with electric blue glow (`drop-shadow-[0_0_20px_rgba(66,165,245,0.5)]`)
- Gradient text: "Scheme Leakage Detection" (using `bg-gradient-to-r from-[#42A5F5] to-[#80D8FF] bg-clip-text text-transparent`)
- Description with real numbers: "See exactly how much scheme money was claimed..."
- Blue gradient CTA button: [Upgrade to Business →]
- Price below: "From ₹13,999/month" in `text-[#90CAF9]`

**The blur effect must be tantalizing** — they can ALMOST see the data through the navy glass.

#### Business Users See:
- Summary card with animated numbers
- Risk badges with colored glow (green/amber/red)
- Export button with download animation

---

### 5.5 Simulator — "What-If Machine"

**Free Plan Gate**: Same stunning navy glass pattern as Reports but with calculator icon and bright blue gradient glow.

**Pro/Business UI**:
- 3-panel layout with glass separators
- Left: Sliders with gradient thumb and track
- Center: Large animated number (projected revenue) that transitions smoothly as sliders move
- Right: Before/after chart with animated draw-in
- Scenario save/reset with satisfying micro-interactions

---

## 6. AppShell — Navigation in Deep Navy

### 6.1 Desktop Sidebar

```tsx
// Navy glass sidebar — blue accents on active items
<aside className={cn(
  "fixed left-0 top-0 bottom-0 w-64",
  "bg-[#051B37]/90 border-r border-[rgba(33,150,243,0.08)]",
  "backdrop-blur-xl",
)}>
  {/* Logo with subtle blue glow */}
  <div className="px-5 py-6">
    <Logo className="text-white" />
    <p className="mt-1 text-xs text-[#5C8FBF] truncate">{userEmail}</p>
    <PlanBadge plan={plan} className="mt-1" />
  </div>
  
  {/* Nav items with blue glow on active */}
  <nav className="px-3 space-y-1">
    <NavItem active>
      {/* Active item: electric blue left bar + blue-tinted bg */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#42A5F5] rounded-r shadow-[0_0_8px_rgba(66,165,245,0.6)]" />
      {/* Active bg */}
      <div className="absolute inset-0 rounded-lg bg-[rgba(33,150,243,0.08)]" />
    </NavItem>
  </nav>
  
  {/* Footer: avatar + sign out */}
  <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[rgba(33,150,243,0.08)]">
    <UserAvatar />
  </div>
</aside>
```

### 6.2 Mobile Bottom Tab Bar

```tsx
// Floating navy glass tab bar — 5 tabs
<div className={cn(
  "fixed bottom-4 left-4 right-4 z-50",
  "flex items-center justify-around",
  "rounded-2xl py-3 px-2",
  "bg-[#051B37]/80 border border-[rgba(33,150,243,0.12)]",
  "backdrop-blur-2xl",
  "shadow-[0_8px_32px_rgba(2,11,24,0.8)]",
)}>
  {tabs.map(tab => (
    <TabItem key={tab.path} active={isActive(tab.path)}>
      {/* Active tab: blue glow dot above icon */}
      {isActive && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-[#1976D2] to-[#42A5F5] shadow-[0_0_8px_rgba(66,165,245,0.6)]" />
      )}
    </TabItem>
  ))}
</div>
```

### 6.3 Mobile Drawer

```tsx
// Slide-in drawer with navy glass backdrop
<motion.div
  initial={{ x: -280 }}
  animate={{ x: 0 }}
  transition={springs.smooth}
>
  {/* Deep navy glass panel */}
  <div className="w-72 h-full bg-[#051B37]/95 backdrop-blur-2xl border-r border-[rgba(33,150,243,0.08)]">
    {/* Same nav as desktop */}
  </div>
</motion.div>

{/* Backdrop */}
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="fixed inset-0 bg-[#020B18]/70 backdrop-blur-sm"
  onClick={closeDrawer}
/>
```

---

## 7. Superadmin — "The Command Center"

The superadmin panel must feel like a **NASA mission control** meets **Bloomberg Terminal** — the deepest navy, dense, powerful, and unmistakably the darkest blue end of the spectrum.

### 7.1 Design Language

```css
/* Superadmin is the DEEPEST navy — even darker than customer app */
--admin-void: #010813;           /* Near-black with blue undertone */
--admin-surface: #020E1F;        /* Deep abyss navy */
--admin-raised: #061A33;         /* Cards on the abyss */
--admin-card: #0A2240;           /* Elevated panels */

/* Accent: Cyan (distinguishes from customer electric-blue) */
--admin-accent: #00BCD4;
--admin-accent-glow: rgba(0, 188, 212, 0.35);

/* Alert semantic colors — high saturation against deep navy */
--admin-critical: #FF3B30;
--admin-warning: #FF9500;
--admin-success: #30D158;
--admin-info: #80D8FF;

/* Borders — very subtle cyan tint */
--admin-border: rgba(0, 188, 212, 0.1);
--admin-border-hover: rgba(0, 188, 212, 0.2);
```

### 7.2 Superadmin Shell

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [✦ AKARA OPS]  Tenants  Users  Revenue  Billing  System  [⚡2] [🔑13m]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ Live Stats ─────────────────────────────────────────────────────┐ │
│  │  MRR: ₹1.2L   Tenants: 47   DAU: 23   Churn: 2.1%   AI ₹: 847│ │
│  │  ──────────────────────────────────────────────────────────────  │ │
│  │  [Critical: 0] [Warning: 2] [Info: 14]                          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────┐ ┌────────────────────────────────┐  │
│  │ TENANT TABLE                │ │ DETAILS DRAWER                 │  │
│  │ Dense rows, teal hover      │ │ All tenant info at a glance    │  │
│  │ Status dots (green/amber/red)│ │ Charts, actions, audit trail   │  │
│  │ Quick-action icons           │ │ Glass panel, slides from right │  │
│  └─────────────────────────────┘ └────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Key Superadmin Treatments

1. **Top Status Bar**: Deep navy bar with live metrics. Numbers tick up/down with cyan glow on change. Alerts badge pulses cyan when non-zero.

2. **Dense Tables**: High information density (Bloomberg-style). Cyan accent on hover (`bg-[rgba(0,188,212,0.06)]`). Status dots pulse on critical states.

3. **Command Palette (⌘K)**: Deep navy frosted glass modal (`bg-[#020E1F]/90 backdrop-blur-2xl`). Fuzzy-find any tenant, user, action. Cyan-highlighted matches.

4. **Detail Drawers**: Slide-in deep navy glass panels with cyan border accent. Include mini-charts with blue-cyan gradients.

5. **Operation Confirmations**: Red-bordered modal on navy backdrop for destructive actions. Impact preview with affected count. Type-to-confirm for dangerous operations.

6. **AI Briefing Tab**: Full-width AI chat on deepest navy. Streaming answers with cyan accent. Responses in glass cards with cyan left-border.

---

## 8. Empty States — Opportunities, Not Dead Ends

Every empty state must:
1. Be visually stunning (illustration + gradient + animation)
2. Clearly explain what's missing
3. Provide an immediate action
4. Make the user WANT to take that action

### 8.1 Template

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="flex flex-col items-center justify-center py-24 text-center"
>
  {/* Animated illustration with blue gradient glow */}
  <div className="relative">
    <div className="absolute inset-0 bg-gradient-to-r from-[#1565C0]/20 to-[#42A5F5]/20 rounded-full blur-3xl" />
    <Icon className="relative w-16 h-16 text-[#64B5F6]" />
  </div>
  
  {/* Blue gradient heading */}
  <h3 className="mt-6 text-xl font-semibold bg-gradient-to-r from-[#42A5F5] to-[#80D8FF] bg-clip-text text-transparent">
    {title}
  </h3>
  
  {/* Muted blue description */}
  <p className="mt-2 text-sm text-[#5C8FBF] max-w-sm">
    {description}
  </p>
  
  {/* Blue gradient CTA */}
  <GradientButton className="mt-6">
    {actionLabel}
  </GradientButton>
</motion.div>
```

---

## 9. Promotional Slots — Revenue Drivers

Slots are the highest-converting UI surfaces. They must be beautiful enough that users don't dismiss them on sight.

### Slot D (Dashboard — First Visit)
- Navy glass card with animated blue gradient border (cycles `#1565C0` → `#42A5F5` → `#80D8FF`)
- Pulsing "✨" emoji
- "Ask your first question" with clear value prop
- Dismiss fades out gracefully, never cuts abruptly

### Slot E (WhatsApp Nudge)
- Navy glass card with amber accent border (`border-[rgba(255,179,0,0.3)]`)
- Phone icon with gentle bob animation
- "Get this dashboard delivered to WhatsApp every Monday"
- Appears with slide-up animation 2s after page load

### Slot F (Copilot Demo)
- Subtle navy glass card below suggested prompts
- "📺 See a 60-second demo" with play button (blue gradient bg)
- Disappears with fade after first message sent

### Slot G (Upgrade Nudge — Data Page)
- Navy glass card with blue→cyan gradient border
- "Unlock secondary sales and scheme data"
- Price shown: "From ₹7,999/month" in `text-[#90CAF9]`
- 7-day localStorage dismissal

---

## 10. Performance Requirements

The UI must be **fast**. Beauty without speed is useless.

1. **First Contentful Paint**: < 1.2s
2. **Largest Contentful Paint**: < 2.5s (landing), < 1.5s (app)
3. **Cumulative Layout Shift**: < 0.05
4. **Total Blocking Time**: < 200ms
5. **Bundle size**: < 200KB initial JS (code-split everything else)

### Rules:
- Lazy-load Framer Motion (only needed for animated pages)
- Lazy-load Recharts (only needed for dashboard/reports)
- Use CSS animations where possible (shimmer, pulse, glow) instead of JS
- Skeleton-first: always show skeleton within 50ms, real data replaces it
- Images: WebP, srcset, lazy loading
- Fonts: preload critical weights only (Inter 400/600, JetBrains Mono 400)

---

## 11. Accessibility — Beautiful AND Usable

All visual effects must degrade gracefully:

```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Contrast requirements */
/* All text on dark surfaces: minimum 4.5:1 contrast ratio */
/* Interactive elements: visible focus ring (electric blue glow) */
/* Never rely on color alone for state indication */
```

### Focus Rings

```css
/* Gorgeous focus that's also accessible */
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--surface-void),
    0 0 0 4px var(--accent-primary),
    0 0 12px var(--accent-primary-glow);
}
```

---

## 12. Implementation Checklist

### Phase 1: Foundation (First 2 hours)
- [ ] Set up CSS custom properties and Tailwind theme
- [ ] Create `GradientMesh` background component
- [ ] Create `LiquidGlassCard` component
- [ ] Create `GlowKPICard` component
- [ ] Create `AnimatedNumber` component
- [ ] Create `ShimmerSkeleton` component
- [ ] Create `GradientButton` component
- [ ] Set up Framer Motion spring configurations
- [ ] Import and configure font stack (Inter, Plus Jakarta, JetBrains Mono)

### Phase 2: AppShell & Navigation (1 hour)
- [ ] Rebuild sidebar with dark glass aesthetic
- [ ] Implement mobile floating bottom tab bar
- [ ] Implement mobile drawer with backdrop blur
- [ ] Add active states with glow effects
- [ ] Add plan badge and quota warning indicators

### Phase 3: Dashboard Transformation (2 hours)
- [ ] Dark background + gradient mesh
- [ ] KPI cards with glow, animated numbers, delta badges
- [ ] Charts with gradient fills and glow filters
- [ ] Outstanding table with red glow indicators
- [ ] Empty state with floating illustration
- [ ] Stale data banner with amber glow
- [ ] Slots D and E with gradient borders

### Phase 4: Copilot Enhancement (2 hours)
- [ ] AI response bubbles with glass morphism
- [ ] User message gradient background
- [ ] Streaming cursor animation
- [ ] Suggested prompts with gradient border pills
- [ ] Feedback buttons with animations
- [ ] Provenance display (monospace, subtle)
- [ ] Error states with semantic coloring
- [ ] Conversation sidebar with glow active state
- [ ] Mobile layout with toggle drawer

### Phase 5: Data Page Upgrade (1.5 hours)
- [ ] Upload zones with animated gradient borders
- [ ] All upload states (idle, drag, uploading, processing, success, error)
- [ ] Progress bar with shimmer
- [ ] Import history with glass table
- [ ] Undo with confirmation modal (glassmorphism)
- [ ] Plan gate overlays with blur effect
- [ ] Slot G with gradient border

### Phase 6: Reports & Simulator (1 hour)
- [ ] Scheme leakage full-page gate (blurred preview)
- [ ] Route performance table with sortable columns
- [ ] Simulator sliders with gradient fills
- [ ] Scenario comparison chart
- [ ] Free plan gates for both pages

### Phase 7: Superadmin (2 hours)
- [ ] Dark command center shell
- [ ] Live status bar with real-time numbers
- [ ] Dense data tables with teal hover
- [ ] Detail drawers with glass panels
- [ ] Command palette (⌘K)
- [ ] AI briefing interface
- [ ] Operation confirmations with danger styling

### Phase 8: Polish & Performance (1 hour)
- [ ] Verify all animations respect `prefers-reduced-motion`
- [ ] Verify WCAG AA contrast on all surfaces
- [ ] Lazy-load heavy dependencies (Framer Motion, Recharts)
- [ ] Run Lighthouse audit (target 90+)
- [ ] Test on mobile (iPhone, Android Chrome)
- [ ] Verify all empty states render correctly
- [ ] Verify all slots appear in correct contexts

---

## 13. Dependencies to Add

| Package | Version | Purpose |
|---|---|---|
| `framer-motion` | `^11.x` | Spring-physics animations, page transitions |
| `@fontsource/plus-jakarta-sans` | `^5.x` | Display typography |
| `@fontsource/inter` | `^5.x` | Body typography |
| `@fontsource/jetbrains-mono` | `^5.x` | Monospace numbers |

Note: `recharts` already installed. `tailwindcss` already installed.

---

## 14. The Feeling We're Creating

When a user first loads the AKARA dashboard, they should experience:

1. **0ms**: Dark void appears (instant)
2. **100ms**: Gradient mesh background fades in softly
3. **200ms**: Glass sidebar materializes
4. **300ms**: Shimmer skeletons appear in content area
5. **500ms**: Data arrives — KPI numbers count up from 0
6. **700ms**: Charts draw themselves in with gradient glow
7. **900ms**: Slots fade in at the bottom
8. **1000ms**: Everything is fully interactive

The total experience should feel like **a luxury sports car starting up** — smooth, powerful, and deeply satisfying.

When a founder opens superadmin, they should feel like they've entered **a control room** — every metric at their fingertips, real-time data flowing, full command over their empire.

This is not a dashboard. This is a **command center for Indian commerce intelligence**.
