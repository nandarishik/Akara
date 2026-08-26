/**
 * LandingPage — AKARA marketing
 *
 * Hyperspeed hero, DecryptedText, MagicBento dashboard preview, PlanReflectiveCard pricing.
 */

import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Menu,
  X,
  ChevronDown,
  FileSpreadsheet,
  MessageSquare,
  Bell,
  AlertTriangle,
} from "lucide-react"
import { useAuth } from "@/features/auth/contexts/AuthContext"
import { PageSEO } from "@/shared/PageSEO"
import { useTypewriter } from "@/shared/hooks/useTypewriter"
import { SecondaryButton } from "@/shared/ui/GradientButton"
import GlowCTAButton, { GlowCTALink } from "@/shared/ui/GlowCTAButton"
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard"
import { Input } from "@/shared/ui/input"
import { HyperspeedBackground, HyperspeedHeroOverlay } from "@/shared/effects/HyperspeedBackground"
import DecryptedText from "@/shared/effects/DecryptedText"
import { GlassIcon } from "@/shared/effects/GlassIcon"
import type { GlassIconColor } from "@/shared/effects/GlassIcons"
import BorderGlow from "@/shared/effects/BorderGlow"
import PlanReflectiveCard, { PLAN_REFLECTIVE_META } from "@/shared/effects/PlanReflectiveCard"
import { dismissSlot, isSlotDismissed, migrateLegacySlotA, PLACEMENT_KEYS, SLOT_KEYS } from "@/lib/promoSlots"
import PrismLazy from "@/shared/effects/PrismLazy"
import { BORDER_GLOW_DEFAULTS } from "@/shared/effects/presets"
import { cn } from "@/lib/utils"
import { usePublicPlans } from "@/features/billing/hooks/usePublicPlans"
import { fetchPublicContent } from "@/lib/api/public"
import { usePlacementSlot } from "@/shared/hooks/usePlacementSlot"

const DashboardPreviewBento = lazy(
  () => import("@/features/landing/components/DashboardPreviewBento")
)

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

const FAQS = [
  { q: "Do I need to know SQL or coding?", a: "No. Just type your question in plain English or Hindi. AKARA translates it into analytics automatically." },
  { q: "What file formats do you accept?", a: "CSV, XLS, and XLSX from any DMS or Tally export. Files up to 20 MB on the free plan." },
  { q: "Is my data secure?", a: "Yes. Row-level security ensures your data is completely isolated from other tenants. We never share it." },
  { q: "Can I cancel anytime?", a: "Yes. Your data is preserved for 30 days after cancellation, then permanently deleted." },
  { q: "What happens when I hit the free limit?", a: "The copilot stops answering. Your dashboard and weekly debrief still work. Upgrade to continue." },
  { q: "Does it work for pharma distribution too?", a: "Yes. The copilot understands FMCG, pharma, industrial, and retail distribution terminology." },
]

const PAIN_CARDS: {
  title: string
  desc: string
  icon: typeof FileSpreadsheet
  color: GlassIconColor
  label: string
}[] = [
  {
    title: "Excel overload",
    desc: "Hours copy-pasting Tally exports into 12 different Excel sheets every Monday.",
    icon: FileSpreadsheet,
    color: "blue",
    label: "Excel overload",
  },
  {
    title: "No quick answers",
    desc: "\"Which zone is underperforming?\" takes 2 hours. It should take 2 seconds.",
    icon: MessageSquare,
    color: "purple",
    label: "Quick answers",
  },
  {
    title: "WhatsApp chaos",
    desc: "Updates buried in 200+ unread messages. No single source of truth.",
    icon: Bell,
    color: "indigo",
    label: "Weekly brief",
  },
  {
    title: "Scheme leakage",
    desc: "Trade schemes paid out but revenue not reflecting. You find out months later.",
    icon: AlertTriangle,
    color: "red",
    label: "Scheme leakage",
  },
]

export function LandingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { plans: publicPlans } = usePublicPlans()
  const displayPlans = publicPlans
  const slotAFallback = {
    title: "Launch promo",
    body: "🚀 Launching WhatsApp weekly briefs — get your data every Monday.",
    cta_label: "Be the first →",
    cta_link: "/signup",
  }
  const { content: slotAContent, trackClick: trackSlotAClick } = usePlacementSlot(PLACEMENT_KEYS.A, slotAFallback)
  const [heroTitle, setHeroTitle] = useState<{ eyebrow?: string; headline?: string; headlineAccent?: string }>({})
  const [heroTagline, setHeroTagline] = useState("")
  const [faqs, setFaqs] = useState(FAQS)
  const [seoTitle, setSeoTitle] = useState("AKARA — FMCG sales intelligence for India")
  const [seoDescription, setSeoDescription] = useState(
    "Import Tally data, ask AI questions, and get weekly debriefs. Built for Indian FMCG distributors and brands.",
  )

  useEffect(() => {
    void Promise.all([
      fetchPublicContent("landing.hero.title"),
      fetchPublicContent("landing.hero.subtitle"),
      fetchPublicContent("landing.faqs"),
      fetchPublicContent("landing.seo.title"),
      fetchPublicContent("landing.seo.description"),
    ]).then(([titleVal, subtitleVal, faqsVal, seoTitleVal, seoDescVal]) => {
      if (titleVal && typeof titleVal === "object") {
        setHeroTitle(titleVal as { eyebrow?: string; headline?: string; headlineAccent?: string })
      }
      if (subtitleVal && typeof subtitleVal === "object" && "text" in (subtitleVal as object)) {
        const text = (subtitleVal as { text?: string }).text
        if (text) setHeroTagline(text)
      }
      if (faqsVal && typeof faqsVal === "object") {
        const items = (faqsVal as { items?: typeof FAQS }).items
        if (Array.isArray(items) && items.length > 0) setFaqs(items)
      }
      if (seoTitleVal && typeof seoTitleVal === "object" && "text" in (seoTitleVal as object)) {
        const text = (seoTitleVal as { text?: string }).text
        if (text) setSeoTitle(text)
      }
      if (seoDescVal && typeof seoDescVal === "object" && "text" in (seoDescVal as object)) {
        const text = (seoDescVal as { text?: string }).text
        if (text) setSeoDescription(text)
      }
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true })
  }, [session, navigate])

  const [navOpen, setNavOpen] = useState(false)

  const [demoOpen, setDemoOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (demoOpen) el.showModal()
    else el.close()
  }, [demoOpen])

  const [slotAVisible, setSlotAVisible] = useState(() => {
    migrateLegacySlotA()
    return !isSlotDismissed(SLOT_KEYS.A)
  })
  function dismissSlotA() {
    dismissSlot(SLOT_KEYS.A)
    setSlotAVisible(false)
  }

  const pricingRef = useRef<HTMLElement>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [slotBDismissed, setSlotBDismissed] = useState(() => isSlotDismissed(SLOT_KEYS.B))
  const [slotCDismissed, setSlotCDismissed] = useState(() => isSlotDismissed(SLOT_KEYS.C))
  const heroRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const onScroll = () => {
      const heroBottom = heroRef.current?.getBoundingClientRect().bottom ?? 0
      const pricingTop = pricingRef.current?.getBoundingClientRect().top ?? 9999
      setShowStickyBar(heroBottom < 0 && pricingTop > 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const [captureEmail, setCaptureEmail] = useState("")
  const [captureHoneypot, setCaptureHoneypot] = useState("")
  const [captureStatus, setCaptureStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  async function handleEmailCapture(e: FormEvent) {
    e.preventDefault()
    setCaptureStatus("loading")
    try {
      await fetch(`${API_BASE}/marketing/email-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: captureEmail, source: "landing_footer", website: captureHoneypot }),
      })
      setCaptureStatus("done")
    } catch {
      setCaptureStatus("error")
    }
  }

  const [demoTab, setDemoTab] = useState<"dashboard" | "ask" | "brief">("ask")
  const [dashboardMounted, setDashboardMounted] = useState(false)
  useEffect(() => {
    if (demoTab === "dashboard") setDashboardMounted(true)
  }, [demoTab])
  const typewriterText = useTypewriter(
    demoTab === "ask" ? "पिछले महीने किस zone की revenue सबसे कम रही?" : "",
    55
  )
  const aiResponse = useTypewriter(
    demoTab === "ask" && typewriterText.length > 30
      ? "South zone had the lowest revenue at ₹4.2L — down 12% vs previous month. North zone led with ₹18.3L."
      : "",
    30
  )

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
      <PageSEO
        title={seoTitle}
        description={seoDescription}
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AKARA",
          applicationCategory: "BusinessApplication",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        }}
      />
      <header className="sticky top-0 z-40 backdrop-blur border-b bg-[#0a0a0a]/80 border-white/10 -mt-0">
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight font-display text-white">
            AKARA
          </a>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-white/80">
            <a href="#features" className="hover:text-[#03B3C3] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#03B3C3] transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
            <GlowCTALink to="/signup" size="sm">Start free →</GlowCTALink>
          </div>
          <button
            className="md:hidden p-2 text-white/80"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </nav>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-[#0a0a0a] border-l border-white/10 shadow-2xl flex flex-col p-6 gap-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-white font-display">AKARA</span>
              <button onClick={() => setNavOpen(false)} aria-label="Close"><X className="w-5 h-5 text-white/60" /></button>
            </div>
            <nav className="flex flex-col gap-4 text-sm font-medium text-white/70">
              <a href="#features" onClick={() => setNavOpen(false)}>Features</a>
              <a href="#pricing" onClick={() => setNavOpen(false)}>Pricing</a>
              <Link to="/login" onClick={() => setNavOpen(false)}>Sign in</Link>
              <GlowCTALink to="/signup" onClick={() => setNavOpen(false)} className="w-full">
                Start free →
              </GlowCTALink>
            </nav>
          </div>
        </div>
      )}

      {/* Hero — Hyperspeed + DecryptedText */}
      <section
        ref={heroRef}
        className="relative min-h-[min(92vh,880px)] overflow-hidden bg-black -mt-16 pt-16"
      >
        <HyperspeedBackground />
        <HyperspeedHeroOverlay />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 pt-12 pb-20 sm:pt-16 sm:pb-28 grid md:grid-cols-[minmax(0,28rem)_1fr] gap-8 lg:gap-20 xl:gap-28 items-center min-h-[min(84vh,800px)]">
          <div className="md:-ml-2 lg:-ml-8 xl:-ml-12">
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-[#03B3C3]">
              {heroTitle.eyebrow ?? "AI Analytics for FMCG Distributors"}
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.08] tracking-tight mb-6">
              <DecryptedText
                text={heroTitle.headline ?? "Know your business"}
                animateOn="view"
                sequential
                revealDirection="center"
                speed={45}
                maxIterations={12}
                className="text-white"
                encryptedClassName="text-white/30"
                parentClassName="block"
              />
              <br />
              <DecryptedText
                text={heroTitle.headlineAccent ?? "in 30 seconds."}
                animateOn="view"
                sequential
                revealDirection="center"
                speed={45}
                maxIterations={12}
                delayMs={900}
                className="text-transparent bg-clip-text bg-gradient-to-r from-[#D856BF] via-[#03B3C3] to-[#0E5EA5]"
                encryptedClassName="text-white/25"
                parentClassName="block"
              />
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-md text-white/75">
              {heroTagline || "Ask in Hindi or English. Get a weekly brief on WhatsApp. Free to start."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <GlowCTALink to="/signup" size="lg">
                Start free — no credit card →
              </GlowCTALink>
              <SecondaryButton
                size="lg"
                onClick={() => setDemoOpen(true)}
                className="border-white/25 text-white hover:bg-white/10 hover:text-white"
              >
                See a 60-second demo
              </SecondaryButton>
            </div>
            <p className="text-xs text-white/45">
              ₹18 Cr revenue analysed · 284 questions answered · 12 distributors
            </p>
            <p className="text-[11px] text-white/35 mt-3 hidden sm:block">
              Hold click or touch the background to speed up
            </p>
          </div>

          <div className="hidden md:flex justify-end md:pr-2 lg:pr-0">
            <div className="w-72 space-y-3 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-medium text-white/50">Monday brief · WhatsApp</span>
              </div>
              <div className="rounded-xl border border-[#03B3C3]/30 bg-[#03B3C3]/10 p-3 text-xs leading-relaxed text-white/90">
                <p className="font-semibold text-[#03B3C3] mb-1.5">Weekly Summary</p>
                Revenue ↑ 8% vs last week<br />
                Top SKU: Maggi 70g (₹3.2L)<br />
                Watch: South zone −12%
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                Outstanding: ₹2.4L across 7 parties
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/45">
                Next brief: Monday, 8:00 AM
              </div>
            </div>
          </div>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="w-[90vw] max-w-4xl rounded-2xl p-0 shadow-card backdrop:bg-black/70"
        onClose={() => setDemoOpen(false)}
      >
        <div className="relative bg-[#0a0a0a] rounded-2xl overflow-hidden">
          <button
            onClick={() => setDemoOpen(false)}
            className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5"
            aria-label="Close demo"
          >
            <X className="w-5 h-5" />
          </button>
          {demoOpen && (
            <iframe src="https://www.loom.com/embed/demo?autoplay=1" className="w-full aspect-video" allow="autoplay" title="AKARA demo video" />
          )}
          <div className="px-6 py-4 flex justify-center bg-[#0a0a0a] border-t border-white/10">
            <GlowCTALink to="/signup" onClick={() => setDemoOpen(false)}>
              Start free →
            </GlowCTALink>
          </div>
        </div>
      </dialog>

      {/* Social proof */}
      <section className="py-14 border-b border-white/10 bg-[#0a0a0a]/50">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-3 gap-6 text-center">
          {[
            ["₹18 Cr+", "Revenue analysed"],
            ["284", "Questions answered"],
            ["12", "Active distributors"],
          ].map(([val, label]) => (
            <div key={label}>
              <p className="text-2xl sm:text-3xl font-bold text-white">{val}</p>
              <p className="text-sm text-white/50 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {slotAVisible && (
        <div className="bg-[#03B3C3]/10 border-b border-[#03B3C3]/20 text-[#03B3C3] py-2.5 px-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium flex-1 text-center">
            {String(slotAContent?.body ?? slotAFallback.body)}{" "}
            <Link to={String(slotAContent?.cta_link ?? "/signup")} onClick={() => trackSlotAClick()} className="underline font-semibold">
              {String(slotAContent?.cta_label ?? slotAFallback.cta_label)}
            </Link>
          </p>
          <button onClick={dismissSlotA} className="text-[#03B3C3]/60 hover:text-[#03B3C3]" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pain cards */}
      <section id="features" className="py-20 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-3 tracking-tight">
            Sound familiar?
          </h2>
          <p className="text-white/60 text-center mb-12 max-w-md mx-auto">
            These are the problems AKARA solves — today, without a 3-month implementation.
          </p>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {PAIN_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <GlowSurfaceCard key={card.title} accent="blue" hover>
                  <div className="flex flex-col gap-3">
                    <GlassIcon
                      icon={<Icon className="h-6 w-6 text-white" />}
                      color={card.color}
                      label={card.label}
                      size="md"
                      decorative
                    />
                    <h3 className="font-semibold text-white mb-0">{card.title}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">{card.desc}</p>
                  </div>
                </GlowSurfaceCard>
              )
            })}
          </div>
        </div>
      </section>

      {/* Product demo */}
      <section className="py-20 px-5 sm:px-8 bg-[#0a0a0a]/40 border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-10 tracking-tight">
            See it in action
          </h2>
          <div className="flex gap-1.5 justify-center mb-8">
            {(["ask", "dashboard", "brief"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDemoTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  demoTab === tab
                    ? "bg-white text-[#0a0a0a]"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                )}
              >
                {tab === "ask" ? "Ask anything" : tab === "dashboard" ? "Dashboard" : "Weekly brief"}
              </button>
            ))}
          </div>

          {demoTab === "ask" && (
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
              <div className="rounded-xl p-4 mb-3 bg-white/5">
                <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">You asked</p>
                <p className="text-white font-medium">{typewriterText}<span className="animate-pulse text-[#03B3C3]">|</span></p>
              </div>
              {aiResponse && (
                <div className="rounded-xl p-4 bg-[#03B3C3]/15 border border-[#03B3C3]/20">
                  <p className="text-[11px] uppercase tracking-wide mb-1.5 text-[#03B3C3]">AKARA</p>
                  <p className="text-white/90 leading-relaxed">{aiResponse}</p>
                </div>
              )}
            </div>
          )}
          {demoTab === "dashboard" && (
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-6 overflow-hidden min-h-[420px]">
              {dashboardMounted && (
                <Suspense fallback={<div className="h-[400px] animate-pulse bg-white/5 rounded-xl" />}>
                  <DashboardPreviewBento />
                </Suspense>
              )}
              <p className="text-center text-xs text-white/40 mt-4">
                Interactive preview — hover tiles to explore
              </p>
            </div>
          )}
          {demoTab === "brief" && (
            <div className="flex justify-center">
              <GlowSurfaceCard className="w-48 h-80 flex items-center justify-center text-white/50 text-sm p-4 text-center">
                WhatsApp brief preview
              </GlowSurfaceCard>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-5 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-14 tracking-tight">
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: "1", title: "Import your data", desc: "Export from Tally or upload any CSV/Excel. Takes 2 minutes." },
              { n: "2", title: "Ask a question", desc: "Type in plain English or Hindi. No SQL, no formulas." },
              { n: "3", title: "Get instant answers", desc: "AKARA analyses your data and responds in seconds." },
              { n: "4", title: "Get weekly brief", desc: "Every Monday on WhatsApp — key metrics, no login." },
            ].map((step) => (
              <div key={step.n} className="text-center">
                <div className="w-10 h-10 rounded-full bg-[#03B3C3] text-[#0a0a0a] text-sm font-bold flex items-center justify-center mx-auto mb-4">
                  {step.n}
                </div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section ref={pricingRef} id="pricing" className="py-20 px-5 sm:px-8 bg-[#0a0a0a]/40">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-3 tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="text-white/60 text-center mb-10">Start free. Upgrade when you&apos;re ready.</p>

          <div className="relative mb-12 min-h-[620px]">
            <PrismLazy
              className="absolute inset-0 opacity-50 pointer-events-none rounded-2xl"
              animationType="rotate"
              timeScale={0.35}
              glow={0.85}
              noise={0.35}
              scale={2.8}
              hueShift={0.5}
              suspendWhenOffscreen
            />
            <div className="relative z-10 grid md:grid-cols-3 gap-6 items-start">
              {displayPlans.map((plan) => {
                const meta = PLAN_REFLECTIVE_META[plan.name]
                return (
                  <BorderGlow
                    key={plan.name}
                    {...BORDER_GLOW_DEFAULTS}
                    borderRadius={20}
                    glowRadius={28}
                    animated={plan.popular}
                    className="h-full overflow-visible"
                  >
                    <div className="p-2">
                      <PlanReflectiveCard
                        plan={{
                          ...plan,
                          badgeText: meta.badgeText,
                          planId: meta.planId,
                          ctaLink: meta.ctaLink,
                        }}
                      />
                    </div>
                  </BorderGlow>
                )
              })}
            </div>
          </div>

          <GlowSurfaceCard accent="blue" className="text-center">
            <p className="font-bold text-lg text-white mb-1">
              Founders deal: First 50 customers get Business tier at Pro price — forever
            </p>
            <p className="text-white/50 text-sm mb-4">43 / 50 spots taken</p>
            <GlowCTALink to="/signup?plan=business&deal=founders">
              Claim your spot →
            </GlowCTALink>
          </GlowSurfaceCard>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-5 sm:px-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12 tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <GlowSurfaceCard key={i} padding="none" className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-white hover:bg-white/5 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={cn("w-4 h-4 text-white/50 flex-shrink-0 ml-4 transition-transform", openFaq === i && "rotate-180")} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-white/70 leading-relaxed">{faq.a}</div>
                )}
              </GlowSurfaceCard>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] text-white py-16 px-5 sm:px-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <p className="text-lg font-bold mb-3 font-display">AKARA</p>
              <p className="text-sm text-white/60">AI analytics for Indian FMCG distributors.</p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3 text-white/80">Product</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Get started</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3 text-white/80">Company</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><a href="mailto:support@akara.ai" className="hover:text-white transition-colors">support@akara.ai</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3 text-white/80">Get launch updates</p>
              {!slotCDismissed && (
                <>
              <p className="text-white/60 text-sm mb-3">Analytics tips + product news</p>
              {captureStatus === "done" ? (
                <p className="text-emerald-400 text-sm">✓ You&apos;re on the list!</p>
              ) : (
                <form onSubmit={handleEmailCapture} className="flex flex-col gap-2">
                  <input
                    type="text"
                    name="website"
                    value={captureHoneypot}
                    onChange={(e) => setCaptureHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    style={{ display: "none" }}
                  />
                  <Input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                  <GlowCTAButton type="submit" loading={captureStatus === "loading"} size="sm" className="w-full">
                    Get updates →
                  </GlowCTAButton>
                </form>
              )}
              <button
                type="button"
                className="mt-2 text-xs text-white/40 hover:text-white/60"
                onClick={() => {
                  dismissSlot(SLOT_KEYS.C)
                  setSlotCDismissed(true)
                }}
              >
                Dismiss
              </button>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-white/50 text-xs">
            <p>© 2025 AKARA Analytics Pvt Ltd. All rights reserved.</p>
            <p>Not affiliated with FireAI or Ocheto. Complementary to both.</p>
          </div>
        </div>
      </footer>

      {showStickyBar && !slotBDismissed && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/10 px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <GlowCTALink to="/signup" className="block flex-1">
              Start free →
            </GlowCTALink>
            <button
              type="button"
              onClick={() => {
                dismissSlot(SLOT_KEYS.B)
                setSlotBDismissed(true)
              }}
              className="text-white/50 hover:text-white px-2"
              aria-label="Dismiss sticky bar"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
