/**
 * LandingPage — Sprint Phase 2, Day 3
 *
 * 9 sections:
 *   1. Sticky responsive nav (hamburger on mobile)
 *   2. Hero with demo dialog (lazy iframe) + sticky mobile CTA bar
 *   3. Social proof bar + Slot A (dismissible WhatsApp banner)
 *   4. Pain cards (2x2 desktop, horizontal scroll-snap mobile)
 *   5. 3-tab product demo (typewriter animation on "Ask anything")
 *   6. How it works (4 steps)
 *   7. Pricing cards + Slot B (founders deal)
 *   8. FAQ accordion
 *   9. Footer with Slot C (email capture + honeypot)
 *
 * SEO: react-helmet-async for title, description, OG, Twitter, JSON-LD.
 */

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { Menu, X, CheckCircle, ChevronDown } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTypewriter } from "@/hooks/useTypewriter"

// --- helpers ---

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

// --- FAQ data ---

const FAQS = [
  {
    q: "Do I need to know SQL or coding?",
    a: "No. Just type your question in plain English or Hindi. AKARA translates it into analytics automatically.",
  },
  {
    q: "What file formats do you accept?",
    a: "CSV, XLS, and XLSX from any DMS or Tally export. Files up to 20 MB on the free plan.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Row-level security ensures your data is completely isolated from other tenants. We never share it.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Your data is preserved for 30 days after cancellation, then permanently deleted.",
  },
  {
    q: "What happens when I hit the free limit?",
    a: "The copilot stops answering. Your dashboard and weekly debrief still work. Upgrade to continue.",
  },
  {
    q: "Does it work for pharma distribution too?",
    a: "Yes. The copilot understands FMCG, pharma, industrial, and retail distribution terminology.",
  },
]

// --- Pricing ---

const PLANS = [
  {
    name: "Free",
    price: "Rs.0",
    period: "/month",
    cta: "Start free →",
    ctaLink: "/signup",
    highlight: false,
    features: [
      "10 copilot questions/month",
      "Up to 10,000 rows",
      "1 user",
      "Basic dashboard & reports",
      "CSV / Excel import",
      "Email support",
    ],
    missing: ["WhatsApp brief", "Secondary sales", "Scheme leakage", "Simulator"],
  },
  {
    name: "Pro",
    price: "Rs.7,999",
    period: "/month",
    cta: "Upgrade to Pro →",
    ctaLink: "/signup",
    highlight: true,
    features: [
      "400 copilot questions/month",
      "Up to 1,00,000 rows",
      "3 users",
      "WhatsApp weekly brief",
      "Secondary sales analytics",
      "Priority support",
    ],
    missing: ["Scheme leakage deep-dive", "Simulator"],
  },
  {
    name: "Business",
    price: "Rs.13,999",
    period: "/month",
    cta: "Upgrade to Business →",
    ctaLink: "/signup",
    highlight: false,
    features: [
      "Unlimited copilot questions",
      "Unlimited rows",
      "Unlimited users",
      "Everything in Pro",
      "Scheme leakage deep-dive",
      "What-if simulator",
      "Dedicated onboarding",
    ],
    missing: [],
  },
]

// --- LandingPage ---

export function LandingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true })
  }, [session, navigate])

  // Nav scroll state
  const [navScrolled, setNavScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Demo dialog
  const [demoOpen, setDemoOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (demoOpen) el.showModal()
    else el.close()
  }, [demoOpen])

  // Slot A -- WhatsApp banner dismissal
  const [slotAVisible, setSlotAVisible] = useState(
    () => localStorage.getItem("banner_wa_dismissed") !== "true"
  )
  function dismissSlotA() {
    localStorage.setItem("banner_wa_dismissed", "true")
    setSlotAVisible(false)
  }

  // Pricing section ref for mobile sticky CTA hiding
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

  // FAQ accordion
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Slot C -- email capture
  const [captureEmail, setCaptureEmail] = useState("")
  const [captureHoneypot, setCaptureHoneypot] = useState("")
  const [captureStatus, setCaptureStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  async function handleEmailCapture(e: React.FormEvent) {
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

  // Demo tab state
  const [demoTab, setDemoTab] = useState<"dashboard" | "ask" | "brief">("ask")
  const typewriterText = useTypewriter(
    demoTab === "ask"
      ? "pichle mahine kis zone ki revenue sabse kam rahi?"
      : "",
    55
  )
  const aiResponse = useTypewriter(
    demoTab === "ask" && typewriterText.length > 30
      ? "South zone had the lowest revenue at Rs.4.2L -- down 12% vs previous month. North zone led with Rs.18.3L."
      : "",
    30
  )

  return (
    <>
      <Helmet>
        <title>AKARA -- AI Analytics for Indian FMCG Distributors</title>
        <meta name="description" content="Ask your sales data anything in Hindi or English. Weekly brief on WhatsApp. Free to start." />
        <meta property="og:title" content="AKARA -- AI Analytics for FMCG Distributors" />
        <meta property="og:description" content="Know your business in 30 seconds. AI analytics built for Indian distributors." />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://akara.ai/" />
      </Helmet>

      {/* Section 1: Nav */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 ${navScrolled ? "bg-white/95 backdrop-blur shadow-sm" : "bg-transparent"}`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-2xl font-extrabold text-violet-700 font-display tracking-tight">AKARA</a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
            <a href="#features" className="hover:text-violet-700 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-violet-700 transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-violet-700 transition-colors">Sign in</Link>
            <Link to="/signup" className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-semibold transition-colors">Start free →</Link>
          </div>
          <button className="md:hidden p-2 text-slate-700" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu className="w-6 h-6" />
          </button>
        </nav>
      </header>

      {/* Mobile slide-over nav */}
      {navOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col p-6 gap-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-extrabold text-violet-700">AKARA</span>
              <button onClick={() => setNavOpen(false)} aria-label="Close menu"><X className="w-6 h-6" /></button>
            </div>
            <nav className="flex flex-col gap-4 text-base font-medium text-slate-700">
              <a href="#features" onClick={() => setNavOpen(false)}>Features</a>
              <a href="#pricing" onClick={() => setNavOpen(false)}>Pricing</a>
              <Link to="/login" onClick={() => setNavOpen(false)}>Sign in</Link>
              <Link to="/signup" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-center" onClick={() => setNavOpen(false)}>Start free →</Link>
            </nav>
          </div>
        </div>
      )}

      {/* Section 2: Hero */}
      <section ref={heroRef} className="pt-32 pb-20 px-4 sm:px-6 bg-gradient-to-br from-violet-50 to-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight font-display mb-4">
              Know your business<br /><span className="text-violet-700">in 30 seconds.</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-md">AI analytics built for Indian FMCG distributors. Ask in Hindi or English. Get a weekly brief on WhatsApp. Free to start.</p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link to="/signup" className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold text-center transition-colors w-full sm:w-auto">Start free -- no credit card →</Link>
              <button onClick={() => setDemoOpen(true)} className="border-2 border-violet-600 text-violet-700 hover:bg-violet-50 px-6 py-3 rounded-lg font-semibold transition-colors w-full sm:w-auto">See a 60-second demo</button>
            </div>
            <p className="text-xs text-slate-400">Rs.18 Cr revenue analysed . 284 questions answered . 12 distributors</p>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="w-48 h-80 rounded-3xl border-4 border-slate-300 bg-white shadow-xl flex items-center justify-center text-slate-400 text-sm p-4 text-center">
              WhatsApp brief mockup
            </div>
          </div>
        </div>
      </section>

      {/* Demo dialog */}
      <dialog ref={dialogRef} className="w-[90vw] max-w-4xl rounded-xl p-0 shadow-2xl backdrop:bg-black/70" onClose={() => setDemoOpen(false)}>
        <div className="relative bg-black rounded-xl overflow-hidden">
          <button onClick={() => setDemoOpen(false)} className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-1" aria-label="Close demo">
            <X className="w-5 h-5" />
          </button>
          {demoOpen && (
            <iframe src="https://www.loom.com/embed/demo?autoplay=1" className="w-full aspect-video" allow="autoplay" title="AKARA demo video" />
          )}
          <div className="bg-black px-6 py-4 flex justify-center">
            <Link to="/signup" onClick={() => setDemoOpen(false)} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold">Start free -- no credit card →</Link>
          </div>
        </div>
      </dialog>

      {/* Section 3: Social proof + Slot A */}
      <section className="py-10 bg-white border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-4 text-center">
          {[["Rs.18 Cr+", "Revenue analysed"], ["284", "Questions answered"], ["12", "Active distributors"]].map(([val, label]) => (
            <div key={label}>
              <p className="text-2xl font-extrabold text-violet-700 font-display">{val}</p>
              <p className="text-sm text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {slotAVisible && (
        <div className="bg-violet-700 text-white py-3 px-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium flex-1 text-center">
            Launching WhatsApp weekly briefs -- get your data in your inbox every Monday
            <Link to="/signup" className="ml-2 underline font-semibold">Be the first to use it →</Link>
          </p>
          <button onClick={dismissSlotA} className="text-white/70 hover:text-white" aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Section 4: Pain cards */}
      <section id="features" className="py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-4 font-display">Sound familiar?</h2>
          <p className="text-slate-500 text-center mb-12 max-w-lg mx-auto">These are the problems AKARA solves -- today, without a 3-month implementation.</p>
          <div className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0" style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
            {[
              { emoji: "chart", title: "Excel overload", desc: "Hours spent copy-pasting Tally exports into 12 different Excel sheets every Monday morning." },
              { emoji: "?", title: "No quick answers", desc: "\"Which zone is underperforming?\" takes 2 hours to answer. It should take 2 seconds." },
              { emoji: "phone", title: "WhatsApp chaos", desc: "Distributor updates buried in 200+ unread WhatsApp messages. No single source of truth." },
              { emoji: "$", title: "Scheme leakage", desc: "Trade schemes paid out but revenue not reflecting. You find out months later, if at all." },
            ].map((card) => (
              <div key={card.title} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex-shrink-0 w-72 md:w-auto" style={{ scrollSnapAlign: "start", minWidth: "280px" }}>
                <h3 className="font-bold text-slate-900 mb-2">{card.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Product demo tabs */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-10 font-display">See it in action</h2>
          <div className="flex gap-2 justify-center mb-8 flex-wrap">
            {(["ask", "dashboard", "brief"] as const).map((tab) => (
              <button key={tab} onClick={() => setDemoTab(tab)} className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${demoTab === tab ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {tab === "ask" ? "Ask anything" : tab === "dashboard" ? "Dashboard" : "Weekly brief"}
              </button>
            ))}
          </div>
          {demoTab === "ask" && (
            <div className="bg-slate-900 rounded-xl p-6 min-h-48">
              <div className="bg-slate-800 rounded-lg p-4 mb-3">
                <p className="text-slate-400 text-xs mb-1">You asked:</p>
                <p className="text-white font-medium">{typewriterText}<span className="animate-pulse">|</span></p>
              </div>
              {aiResponse && (
                <div className="bg-violet-900/40 border border-violet-700/50 rounded-lg p-4">
                  <p className="text-slate-400 text-xs mb-1">AKARA:</p>
                  <p className="text-violet-100">{aiResponse}</p>
                </div>
              )}
            </div>
          )}
          {demoTab === "dashboard" && (
            <div className="bg-slate-100 rounded-xl p-8 text-center text-slate-400 min-h-48 flex items-center justify-center">
              Dashboard screenshot -- coming soon
            </div>
          )}
          {demoTab === "brief" && (
            <div className="flex justify-center">
              <div className="w-48 h-80 rounded-3xl border-4 border-slate-300 bg-white shadow-xl flex items-center justify-center text-slate-400 text-sm p-4 text-center">
                WhatsApp brief preview
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 6: How it works */}
      <section className="py-20 px-4 sm:px-6 bg-violet-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-12 font-display">How it works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: "1", title: "Import your data", desc: "Export from Tally or upload any CSV/Excel. Takes 2 minutes." },
              { n: "2", title: "Ask a question", desc: "Type in plain English or Hindi. No SQL, no formulas." },
              { n: "3", title: "Get instant answers", desc: "AKARA analyses your data and responds in seconds." },
              { n: "4", title: "Get your weekly brief", desc: "Every Monday on WhatsApp -- key metrics, no login required." },
            ].map((step) => (
              <div key={step.n} className="bg-white rounded-xl p-6 shadow-sm text-center">
                <div className="w-10 h-10 rounded-full bg-violet-700 text-white font-extrabold text-lg flex items-center justify-center mx-auto mb-4">{step.n}</div>
                <h3 className="font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7: Pricing + Slot B */}
      <section ref={pricingRef} id="pricing" className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-3 font-display">Simple, honest pricing</h2>
          <p className="text-slate-500 text-center mb-12">Start free. Upgrade when you're ready. No long-term contracts.</p>
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`rounded-xl p-6 border-2 ${plan.highlight ? "border-violet-600 shadow-lg relative" : "border-slate-200"}`}>
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs px-3 py-1 rounded-full font-semibold">Most popular</span>
                )}
                <h3 className="font-extrabold text-slate-900 text-xl mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl font-extrabold text-violet-700">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link to={plan.ctaLink} className={`block text-center py-2.5 rounded-lg font-semibold transition-colors ${plan.highlight ? "bg-orange-500 hover:bg-orange-600 text-white" : "border-2 border-violet-600 text-violet-700 hover:bg-violet-50"}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
          {/* Slot B */}
          <div className="rounded-xl p-6 border-2 border-transparent bg-gradient-to-r from-violet-600 to-amber-500 text-white text-center">
            <p className="font-extrabold text-lg mb-1">Founders deal: First 50 customers get Business tier at Pro price -- forever</p>
            <p className="text-white/80 text-sm mb-4">43 / 50 spots taken</p>
            <Link to="/signup?plan=business&deal=founders" className="inline-block bg-white text-violet-700 font-semibold px-6 py-2 rounded-lg hover:bg-violet-50 transition-colors">Claim your spot →</Link>
          </div>
        </div>
      </section>

      {/* Section 8: FAQ */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-10 font-display">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-slate-900 hover:bg-slate-50 transition-colors" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-4 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-slate-600 text-sm leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 9: Footer + Slot C */}
      <footer className="bg-slate-900 text-white py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <p className="text-xl font-extrabold mb-3">AKARA</p>
              <p className="text-slate-400 text-sm">AI analytics for Indian FMCG distributors.</p>
            </div>
            <div>
              <p className="font-semibold mb-3 text-slate-300">Product</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><Link to="/signup" className="hover:text-white">Get started</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-3 text-slate-300">Company</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><a href="mailto:support@akara.ai" className="hover:text-white">support@akara.ai</a></li>
              </ul>
            </div>
            <div>
              {/* Slot C -- email capture */}
              <p className="font-semibold mb-3 text-slate-300">Get launch updates</p>
              <p className="text-slate-400 text-sm mb-3">FMCG analytics tips + product updates</p>
              {captureStatus === "done" ? (
                <p className="text-emerald-400 text-sm">You're on the list!</p>
              ) : (
                <form onSubmit={handleEmailCapture} className="flex flex-col gap-2">
                  <input type="text" name="website" value={captureHoneypot} onChange={(e) => setCaptureHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ display: "none" }} />
                  <input type="email" required placeholder="you@company.com" value={captureEmail} onChange={(e) => setCaptureEmail(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-violet-400" />
                  <button type="submit" disabled={captureStatus === "loading"} className="bg-violet-600 hover:bg-violet-500 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                    {captureStatus === "loading" ? "Sending..." : "Get updates →"}
                  </button>
                </form>
              )}
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-400 text-sm">
            <p>2025 AKARA Analytics Pvt Ltd. All rights reserved.</p>
            <p>Not affiliated with FireAI or Ocheto.</p>
          </div>
        </div>
      </footer>

      {/* Mobile sticky CTA bar */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 md:hidden shadow-lg">
          <Link to="/signup" className="block w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold text-center transition-colors">Start free →</Link>
        </div>
      )}
    </>
  )
}
