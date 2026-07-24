/**
 * LandingPage — AKARA Blue (FireAI light)
 *
 * Sticky light nav, light hero with CTAs, SurfaceCard/PlanCard pricing,
 * dark footer band only at bottom. Token colors + AkaraButton CTAs.
 */

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Menu, X, ChevronDown } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTypewriter } from "@/hooks/useTypewriter"
import { AkaraButton, SecondaryButton } from "@/components/ui/GradientButton"
import { PlanCard } from "@/components/ui/card"
import SurfaceCard from "@/components/ui/SurfaceCard"
import { Input } from "@/components/ui/input"

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
    popular: false,
    features: ["10 copilot questions/month", "Up to 10,000 rows", "1 user", "Basic dashboard & reports", "CSV / Excel import", "Email support"],
  },
  {
    name: "Pro",
    price: "₹7,999",
    period: "/month",
    cta: "Upgrade to Pro →",
    ctaLink: "/signup",
    popular: true,
    features: ["400 copilot questions/month", "Up to 1,00,000 rows", "3 users", "WhatsApp weekly brief", "Secondary sales analytics", "Priority support"],
  },
  {
    name: "Business",
    price: "₹13,999",
    period: "/month",
    cta: "Upgrade to Business →",
    ctaLink: "/signup",
    popular: false,
    features: ["Unlimited copilot questions", "Unlimited rows", "Unlimited users", "Everything in Pro", "Scheme leakage deep-dive", "What-if simulator", "Dedicated onboarding"],
  },
]

export function LandingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

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
    <div className="min-h-screen overflow-x-hidden bg-surface-bg">
      {/* Sticky nav */}
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur border-b border-surface-border">
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight text-text-primary font-display">
            AKARA
          </a>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-text-secondary">
            <a href="#features" className="hover:text-accent transition-colors">Features</a>
            <a href="#pricing" className="hover:text-accent transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-accent transition-colors">Sign in</Link>
            <Link to="/signup">
              <AkaraButton size="sm">Start free →</AkaraButton>
            </Link>
          </div>
          <button className="md:hidden p-2 text-text-secondary" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
        </nav>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-surface-card shadow-card flex flex-col p-6 gap-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-text-primary font-display">AKARA</span>
              <button onClick={() => setNavOpen(false)} aria-label="Close"><X className="w-5 h-5 text-text-muted" /></button>
            </div>
            <nav className="flex flex-col gap-4 text-sm font-medium text-text-secondary">
              <a href="#features" onClick={() => setNavOpen(false)}>Features</a>
              <a href="#pricing" onClick={() => setNavOpen(false)}>Pricing</a>
              <Link to="/login" onClick={() => setNavOpen(false)}>Sign in</Link>
              <Link to="/signup" onClick={() => setNavOpen(false)}>
                <AkaraButton className="w-full">Start free →</AkaraButton>
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Hero — light */}
      <section ref={heroRef} className="pt-12 pb-20 sm:pt-16 sm:pb-28 px-5 sm:px-8 bg-surface-bg">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-accent">
              AI Analytics for FMCG Distributors
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.08] tracking-tight text-text-primary mb-6">
              Know your business
              <br />
              <span className="text-accent">in 30 seconds.</span>
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-md text-text-secondary">
              Ask in Hindi or English. Get a weekly brief on WhatsApp. Free to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link to="/signup">
                <AkaraButton size="lg">Start free — no credit card →</AkaraButton>
              </Link>
              <SecondaryButton size="lg" onClick={() => setDemoOpen(true)}>
                See a 60-second demo
              </SecondaryButton>
            </div>
            <p className="text-xs text-text-muted">
              ₹18 Cr revenue analysed · 284 questions answered · 12 distributors
            </p>
          </div>

          <div className="hidden md:flex justify-center">
            <SurfaceCard padding="lg" className="w-72 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium text-text-muted">Monday brief · WhatsApp</span>
              </div>
              <SurfaceCard padding="sm" accent="blue" className="text-xs leading-relaxed">
                <p className="font-semibold text-accent mb-1.5">Weekly Summary</p>
                Revenue ↑ 8% vs last week<br />
                Top SKU: Maggi 70g (₹3.2L)<br />
                Watch: South zone −12%
              </SurfaceCard>
              <div className="rounded-lg border border-surface-border bg-surface-raised p-3 text-xs text-text-secondary">
                Outstanding: ₹2.4L across 7 parties
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-raised p-3 text-xs text-text-muted">
                Next brief: Monday, 8:00 AM
              </div>
            </SurfaceCard>
          </div>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="w-[90vw] max-w-4xl rounded-2xl p-0 shadow-card backdrop:bg-black/70"
        onClose={() => setDemoOpen(false)}
      >
        <div className="relative bg-band-dark rounded-2xl overflow-hidden">
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
          <div className="px-6 py-4 flex justify-center bg-band-dark border-t border-white/10">
            <Link to="/signup" onClick={() => setDemoOpen(false)}>
              <AkaraButton>Start free →</AkaraButton>
            </Link>
          </div>
        </div>
      </dialog>

      {/* Social proof */}
      <section className="py-14 bg-surface-card border-b border-surface-border">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-3 gap-6 text-center">
          {[
            ["₹18 Cr+", "Revenue analysed"],
            ["284", "Questions answered"],
            ["12", "Active distributors"],
          ].map(([val, label]) => (
            <div key={label}>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary">{val}</p>
              <p className="text-sm text-text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {slotAVisible && (
        <div className="bg-accent-soft border-b border-surface-border text-accent-hover py-2.5 px-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium flex-1 text-center">
            🚀 Launching WhatsApp weekly briefs — get your data every Monday.{" "}
            <Link to="/signup" className="underline font-semibold">Be the first →</Link>
          </p>
          <button onClick={dismissSlotA} className="text-accent/60 hover:text-accent" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pain cards */}
      <section id="features" className="py-20 px-5 sm:px-8 bg-surface-bg">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-3 tracking-tight">
            Sound familiar?
          </h2>
          <p className="text-text-muted text-center mb-14 max-w-md mx-auto">
            These are the problems AKARA solves — today, without a 3-month implementation.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              { title: "Excel overload", desc: "Hours copy-pasting Tally exports into 12 different Excel sheets every Monday." },
              { title: "No quick answers", desc: "\"Which zone is underperforming?\" takes 2 hours. It should take 2 seconds." },
              { title: "WhatsApp chaos", desc: "Updates buried in 200+ unread messages. No single source of truth." },
              { title: "Scheme leakage", desc: "Trade schemes paid out but revenue not reflecting. You find out months later." },
            ].map((card) => (
              <SurfaceCard key={card.title} accent="blue" hover>
                <h3 className="font-semibold text-text-primary mb-2">{card.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{card.desc}</p>
              </SurfaceCard>
            ))}
          </div>
        </div>
      </section>

      {/* Product demo */}
      <section className="py-20 px-5 sm:px-8 bg-surface-card">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-10 tracking-tight">
            See it in action
          </h2>
          <div className="flex gap-1.5 justify-center mb-8">
            {(["ask", "dashboard", "brief"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDemoTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  demoTab === tab
                    ? "bg-text-primary text-white"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-raised"
                }`}
              >
                {tab === "ask" ? "Ask anything" : tab === "dashboard" ? "Dashboard" : "Weekly brief"}
              </button>
            ))}
          </div>

          {demoTab === "ask" && (
            <div className="bg-band-dark rounded-2xl p-6">
              <div className="rounded-xl p-4 mb-3 bg-white/5">
                <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1.5">You asked</p>
                <p className="text-white font-medium">{typewriterText}<span className="animate-pulse text-accent">|</span></p>
              </div>
              {aiResponse && (
                <div className="rounded-xl p-4 bg-accent/15 border border-accent/20">
                  <p className="text-[11px] uppercase tracking-wide mb-1.5 text-accent">AKARA</p>
                  <p className="text-white/90 leading-relaxed">{aiResponse}</p>
                </div>
              )}
            </div>
          )}
          {demoTab === "dashboard" && (
            <SurfaceCard className="p-10 text-center text-text-muted">
              Dashboard preview — coming soon
            </SurfaceCard>
          )}
          {demoTab === "brief" && (
            <div className="flex justify-center">
              <SurfaceCard className="w-48 h-80 flex items-center justify-center text-text-muted text-sm p-4 text-center">
                WhatsApp brief preview
              </SurfaceCard>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-5 sm:px-8 bg-surface-raised/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-14 tracking-tight">
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
                <div className="w-10 h-10 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center mx-auto mb-4">
                  {step.n}
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section ref={pricingRef} id="pricing" className="py-20 px-5 sm:px-8 bg-surface-card">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-3 tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="text-text-muted text-center mb-14">Start free. Upgrade when you&apos;re ready.</p>

          <div className="grid md:grid-cols-3 gap-5 mb-12">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.name}
                name={plan.name}
                price={plan.price}
                period={plan.period}
                features={plan.features}
                popular={plan.popular}
                cta={
                  plan.popular ? (
                    <Link to={plan.ctaLink}>
                      <AkaraButton className="w-full" size="sm">{plan.cta}</AkaraButton>
                    </Link>
                  ) : (
                    <Link to={plan.ctaLink}>
                      <SecondaryButton className="w-full" size="sm">{plan.cta}</SecondaryButton>
                    </Link>
                  )
                }
              />
            ))}
          </div>

          <SurfaceCard accent="blue" className="text-center">
            <p className="font-bold text-lg text-text-primary mb-1">
              Founders deal: First 50 customers get Business tier at Pro price — forever
            </p>
            <p className="text-text-muted text-sm mb-4">43 / 50 spots taken</p>
            <Link to="/signup?plan=business&deal=founders">
              <AkaraButton>Claim your spot →</AkaraButton>
            </Link>
          </SurfaceCard>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-5 sm:px-8 bg-surface-raised/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-12 tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <SurfaceCard key={i} padding="none" className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-text-primary hover:bg-surface-raised/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 ml-4 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">{faq.a}</div>
                )}
              </SurfaceCard>
            ))}
          </div>
        </div>
      </section>

      {/* Dark footer band */}
      <footer className="bg-band-dark text-text-inverse py-16 px-5 sm:px-8">
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
                  <AkaraButton type="submit" loading={captureStatus === "loading"} size="sm" className="w-full">
                    Get updates →
                  </AkaraButton>
                </form>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-white/50 text-xs">
            <p>© 2025 AKARA Analytics Pvt Ltd. All rights reserved.</p>
            <p>Not affiliated with FireAI or Ocheto. Complementary to both.</p>
          </div>
        </div>
      </footer>

      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-card/95 backdrop-blur border-t border-surface-border px-4 py-3 md:hidden">
          <Link to="/signup" className="block">
            <AkaraButton className="w-full">Start free →</AkaraButton>
          </Link>
        </div>
      )}
    </div>
  )
}
