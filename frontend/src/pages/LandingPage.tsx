/**
 * LandingPage — AKARA Blue (FireAI-inspired)
 *
 * Design approach:
 * - Hero: dramatic dark navy → blue gradient (the "wow" moment)
 * - Body sections: clean, light, premium white with blue accents
 * - Footer: dark navy
 * - Blue is an ACCENT, not a wallpaper
 * - Generous whitespace, restrained typography, financial-grade polish
 */

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Menu, X, CheckCircle, ChevronDown } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTypewriter } from "@/hooks/useTypewriter"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

const FAQS = [
  { q: "Do I need to know SQL or coding?", a: "No. Just type your question in plain English or Hindi. AKARA translates it into analytics automatically." },
  { q: "What file formats do you accept?", a: "CSV, XLS, and XLSX from any DMS or Tally export. Files up to 20 MB on the free plan." },
  { q: "Is my data secure?", a: "Yes. Row-level security ensures your data is completely isolated from other tenants. We never share it." },
  { q: "Can I cancel anytime?", a: "Yes. Your data is preserved for 30 days after cancellation, then permanently deleted." },
  { q: "What happens when I hit the free limit?", a: "The copilot stops answering. Your dashboard and weekly debrief still work. Upgrade to continue." },
  { q: "Does it work for pharma distribution too?", a: "Yes. The copilot understands FMCG, pharma, industrial, and retail distribution terminology." },
]

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "/month",
    cta: "Start free →",
    ctaLink: "/signup",
    highlight: false,
    features: ["10 copilot questions/month", "Up to 10,000 rows", "1 user", "Basic dashboard & reports", "CSV / Excel import", "Email support"],
  },
  {
    name: "Pro",
    price: "₹7,999",
    period: "/month",
    cta: "Upgrade to Pro →",
    ctaLink: "/signup",
    highlight: true,
    features: ["400 copilot questions/month", "Up to 1,00,000 rows", "3 users", "WhatsApp weekly brief", "Secondary sales analytics", "Priority support"],
  },
  {
    name: "Business",
    price: "₹13,999",
    period: "/month",
    cta: "Upgrade to Business →",
    ctaLink: "/signup",
    highlight: false,
    features: ["Unlimited copilot questions", "Unlimited rows", "Unlimited users", "Everything in Pro", "Scheme leakage deep-dive", "What-if simulator", "Dedicated onboarding"],
  },
]

export function LandingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true })
  }, [session, navigate])

  const [navScrolled, setNavScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const [demoOpen, setDemoOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (demoOpen) el.showModal()
    else el.close()
  }, [demoOpen])

  const [slotAVisible, setSlotAVisible] = useState(
    () => localStorage.getItem("banner_wa_dismissed") !== "true"
  )
  function dismissSlotA() {
    localStorage.setItem("banner_wa_dismissed", "true")
    setSlotAVisible(false)
  }

  const pricingRef = useRef<HTMLElement>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const onScroll = () => {
      const heroBottom = heroRef.current?.getBoundingClientRect().bottom ?? 0
      const pricingTop = pricingRef.current?.getBoundingClientRect().top ?? 9999
      setShowStickyBar(heroBottom < 0 && pricingTop > 0)
    }
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
    <div className="min-h-screen overflow-x-hidden bg-[#FAFCFF]">
      {/* ═══════════════════════════════════════════════════════════════════
          NAV — clean, minimal, floats over hero
      ═══════════════════════════════════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          navScrolled
            ? "bg-white/90 backdrop-blur-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] border-b border-slate-100"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight text-[#0A1628]">
            AKARA
          </a>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-slate-600">
            <a href="#features" className="hover:text-[#1565C0] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#1565C0] transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-[#1565C0] transition-colors">Sign in</Link>
            <Link
              to="/signup"
              className="text-white px-4 py-2 rounded-lg font-semibold text-[13px] transition-all hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-[1px]"
              style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
            >
              Start free →
            </Link>
          </div>
          <button className="md:hidden p-2 text-slate-700" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
        </nav>
      </header>

      {/* Mobile nav */}
      {navOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col p-6 gap-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-[#0A1628]">AKARA</span>
              <button onClick={() => setNavOpen(false)} aria-label="Close"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <nav className="flex flex-col gap-4 text-sm font-medium text-slate-700">
              <a href="#features" onClick={() => setNavOpen(false)}>Features</a>
              <a href="#pricing" onClick={() => setNavOpen(false)}>Pricing</a>
              <Link to="/login" onClick={() => setNavOpen(false)}>Sign in</Link>
              <Link
                to="/signup"
                className="text-white text-center px-4 py-2.5 rounded-lg font-semibold"
                style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
                onClick={() => setNavOpen(false)}
              >
                Start free →
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — the ONE dramatic section: navy → blue gradient
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative pt-24 pb-20 sm:pt-32 sm:pb-28 px-5 sm:px-8 overflow-hidden"
        style={{
          background: "linear-gradient(170deg, #020B18 0%, #0A1F3D 35%, #0F3460 65%, #1565C0 100%)",
        }}
      >
        {/* Subtle radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(66,165,245,0.4) 0%, transparent 65%)" }}
        />

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center relative">
          <div>
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4" style={{ color: "#64B5F6" }}>
              AI Analytics for FMCG Distributors
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.08] tracking-tight text-white mb-6">
              Know your business
              <br />
              <span style={{ color: "#64B5F6" }}>in 30 seconds.</span>
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-md" style={{ color: "rgba(255,255,255,0.7)" }}>
              Ask in Hindi or English. Get a weekly brief on WhatsApp. Free to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link
                to="/signup"
                className="text-white px-6 py-3 rounded-lg font-semibold text-center transition-all hover:shadow-xl hover:shadow-blue-500/25 hover:-translate-y-[1px]"
                style={{ background: "linear-gradient(135deg, #1E88E5, #42A5F5)" }}
              >
                Start free — no credit card →
              </Link>
              <button
                onClick={() => setDemoOpen(true)}
                className="px-6 py-3 rounded-lg font-semibold text-center transition-all border border-white/20 text-white/90 hover:bg-white/10"
              >
                See a 60-second demo
              </button>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              ₹18 Cr revenue analysed · 284 questions answered · 12 distributors
            </p>
          </div>

          {/* Mockup — glass card, not phone */}
          <div className="hidden md:flex justify-center">
            <div
              className="w-72 rounded-2xl p-5 space-y-3"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-medium text-white/60">Monday brief · WhatsApp</span>
              </div>
              <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}>
                <p className="font-semibold text-[#64B5F6] mb-1.5">Weekly Summary</p>
                Revenue ↑ 8% vs last week<br />
                Top SKU: Maggi 70g (₹3.2L)<br />
                Watch: South zone −12%
              </div>
              <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}>
                Outstanding: ₹2.4L across 7 parties
              </div>
              <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}>
                Next brief: Monday, 8:00 AM
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo dialog */}
      <dialog
        ref={dialogRef}
        className="w-[90vw] max-w-4xl rounded-2xl p-0 shadow-2xl backdrop:bg-black/70"
        onClose={() => setDemoOpen(false)}
      >
        <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
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
          <div className="px-6 py-4 flex justify-center bg-slate-950">
            <Link
              to="/signup"
              onClick={() => setDemoOpen(false)}
              className="text-white px-6 py-2.5 rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/25"
              style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
            >
              Start free →
            </Link>
          </div>
        </div>
      </dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          SOCIAL PROOF — light section, clean numbers
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-14 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-3 gap-6 text-center">
          {[
            ["₹18 Cr+", "Revenue analysed"],
            ["284", "Questions answered"],
            ["12", "Active distributors"],
          ].map(([val, label]) => (
            <div key={label}>
              <p className="text-2xl sm:text-3xl font-bold text-[#0A1628]">{val}</p>
              <p className="text-sm text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Slot A — WhatsApp banner (subtle blue) */}
      {slotAVisible && (
        <div className="bg-[#1565C0] text-white py-2.5 px-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium flex-1 text-center">
            🚀 Launching WhatsApp weekly briefs — get your data every Monday.{" "}
            <Link to="/signup" className="underline font-semibold">Be the first →</Link>
          </p>
          <button onClick={dismissSlotA} className="text-white/60 hover:text-white" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PAIN CARDS — light bg, clean cards with subtle blue accent
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 px-5 sm:px-8 bg-[#FAFCFF]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] text-center mb-3 tracking-tight">
            Sound familiar?
          </h2>
          <p className="text-slate-500 text-center mb-14 max-w-md mx-auto">
            These are the problems AKARA solves — today, without a 3-month implementation.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              { title: "Excel overload", desc: "Hours copy-pasting Tally exports into 12 different Excel sheets every Monday." },
              { title: "No quick answers", desc: "\"Which zone is underperforming?\" takes 2 hours. It should take 2 seconds." },
              { title: "WhatsApp chaos", desc: "Updates buried in 200+ unread messages. No single source of truth." },
              { title: "Scheme leakage", desc: "Trade schemes paid out but revenue not reflecting. You find out months later." },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-xl p-6 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow"
              >
                <div className="w-8 h-0.5 rounded-full bg-[#1976D2] mb-4 opacity-60" />
                <h3 className="font-semibold text-[#0A1628] mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PRODUCT DEMO — light bg, dark terminal for the demo
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] text-center mb-10 tracking-tight">
            See it in action
          </h2>
          <div className="flex gap-1.5 justify-center mb-8">
            {(["ask", "dashboard", "brief"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDemoTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  demoTab === tab
                    ? "bg-[#0A1628] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {tab === "ask" ? "Ask anything" : tab === "dashboard" ? "Dashboard" : "Weekly brief"}
              </button>
            ))}
          </div>

          {demoTab === "ask" && (
            <div className="bg-[#0A1628] rounded-2xl p-6 shadow-xl">
              <div className="rounded-xl p-4 mb-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">You asked</p>
                <p className="text-white font-medium">{typewriterText}<span className="animate-pulse text-[#42A5F5]">|</span></p>
              </div>
              {aiResponse && (
                <div className="rounded-xl p-4" style={{ background: "rgba(21,101,192,0.15)", border: "1px solid rgba(66,165,245,0.2)" }}>
                  <p className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "#64B5F6" }}>AKARA</p>
                  <p className="text-white/90 leading-relaxed">{aiResponse}</p>
                </div>
              )}
            </div>
          )}
          {demoTab === "dashboard" && (
            <div className="bg-slate-50 rounded-2xl p-10 text-center text-slate-400 border border-slate-100">
              Dashboard preview — coming soon
            </div>
          )}
          {demoTab === "brief" && (
            <div className="flex justify-center">
              <div className="w-48 h-80 rounded-3xl border-2 border-slate-200 bg-white shadow-sm flex items-center justify-center text-slate-400 text-sm p-4 text-center">
                WhatsApp brief preview
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — subtle grey bg, clean steps
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 bg-slate-50/70">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] text-center mb-14 tracking-tight">
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
                <div
                  className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
                >
                  {step.n}
                </div>
                <h3 className="font-semibold text-[#0A1628] mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PRICING — white bg, clean cards, blue accent on featured
      ═══════════════════════════════════════════════════════════════════ */}
      <section ref={pricingRef} id="pricing" className="py-20 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] text-center mb-3 tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="text-slate-500 text-center mb-14">Start free. Upgrade when you&apos;re ready.</p>

          <div className="grid md:grid-cols-3 gap-5 mb-12">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 relative transition-all ${
                  plan.highlight
                    ? "border-2 border-[#1976D2] shadow-[0_4px_24px_rgba(25,118,210,0.12)]"
                    : "border border-slate-150 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                }`}
                style={{ backgroundColor: plan.highlight ? "#FAFEFF" : "#fff" }}
              >
                {plan.highlight && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1 rounded-full font-semibold"
                    style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
                  >
                    Most popular
                  </span>
                )}
                <h3 className="font-bold text-[#0A1628] text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl font-bold text-[#0A1628]">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckCircle className="w-4 h-4 text-[#1976D2] mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaLink}
                  className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    plan.highlight
                      ? "text-white hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-[1px]"
                      : "text-[#1565C0] border border-[#1976D2]/30 hover:bg-blue-50"
                  }`}
                  style={plan.highlight ? { background: "linear-gradient(135deg, #1565C0, #1E88E5)" } : undefined}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Slot B — Founders deal */}
          <div
            className="rounded-2xl p-6 text-center text-white"
            style={{ background: "linear-gradient(135deg, #0F3460 0%, #1565C0 50%, #1E88E5 100%)" }}
          >
            <p className="font-bold text-lg mb-1">
              Founders deal: First 50 customers get Business tier at Pro price — forever
            </p>
            <p className="text-white/70 text-sm mb-4">43 / 50 spots taken</p>
            <Link
              to="/signup?plan=business&deal=founders"
              className="inline-block bg-white text-[#0F3460] font-semibold px-6 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Claim your spot →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FAQ — light grey bg, minimal
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 bg-slate-50/70">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] text-center mb-12 tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-[#0A1628] hover:bg-slate-50/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-4 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER — dark navy (the bookend to the hero)
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#0A1628] text-white py-16 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <p className="text-lg font-bold mb-3">AKARA</p>
              <p className="text-sm text-slate-400">AI analytics for Indian FMCG distributors.</p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3 text-slate-300">Product</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Get started</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3 text-slate-300">Company</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><a href="mailto:support@akara.ai" className="hover:text-white transition-colors">support@akara.ai</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3 text-slate-300">Get launch updates</p>
              <p className="text-slate-400 text-sm mb-3">Analytics tips + product news</p>
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
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1976D2]/50 focus:ring-1 focus:ring-[#1976D2]/30"
                  />
                  <button
                    type="submit"
                    disabled={captureStatus === "loading"}
                    className="text-white py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
                  >
                    {captureStatus === "loading" ? "Sending..." : "Get updates →"}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 text-xs">
            <p>© 2025 AKARA Analytics Pvt Ltd. All rights reserved.</p>
            <p>Not affiliated with FireAI or Ocheto. Complementary to both.</p>
          </div>
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-100 px-4 py-3 md:hidden shadow-lg">
          <Link
            to="/signup"
            className="block w-full text-white py-3 rounded-lg font-semibold text-center"
            style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
          >
            Start free →
          </Link>
        </div>
      )}
    </div>
  )
}
