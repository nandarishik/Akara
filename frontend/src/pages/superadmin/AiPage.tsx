import { useEffect, useRef, useState } from "react";
import { sa, type FounderBriefRow } from "@/lib/api/superadmin";

/** Next founder brief runs at 7:00 AM IST daily. */
function nextFounderBriefTime(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  let candidate = new Date(`${y}-${m}-${d}T01:30:00.000Z`);
  if (candidate <= now) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

export function SuperadminAiPage() {
  const [chips, setChips] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [brief, setBrief] = useState("");
  const [briefHistory, setBriefHistory] = useState<FounderBriefRow[]>([]);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [nextBrief, setNextBrief] = useState<Date>(() => nextFounderBriefTime());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void sa.copilotChips().then((r) => setChips(r.chips));
    void sa.founderBriefHistory().then((r) => setBriefHistory(r.items));
    const id = window.setInterval(() => setNextBrief(nextFounderBriefTime()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [answer]);

  async function sendChat(q: string) {
    if (!q.trim() || streaming) return;
    setQuestion("");
    setAnswer("");
    setStreaming(true);
    try {
      const token = await import("@/lib/supabase").then((m) => m.supabase.auth.getSession());
      const access = token.data.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/superadmin/copilot/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: q, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        for (const line of buf.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { content?: string; error?: string };
            if (parsed.content) setAnswer((prev) => prev + parsed.content);
            if (parsed.error) setAnswer(parsed.error);
          } catch {
            /* skip partial */
          }
        }
        buf = "";
      }
    } catch (err) {
      setAnswer(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setStreaming(false);
    }
  }

  async function regenerateBrief() {
    const r = await sa.runFounderBrief();
    setBrief(r.text);
    setSelectedBriefId(null);
    const h = await sa.founderBriefHistory();
    setBriefHistory(h.items);
  }

  function selectHistoryItem(item: FounderBriefRow) {
    setSelectedBriefId(item.id);
    setBrief(item.brief_text);
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)] text-sa-text">
      <aside className="w-[260px] shrink-0 space-y-3 overflow-y-auto">
        <h2 className="text-lg font-semibold">AI Briefing</h2>
        <p className="text-xs text-sa-muted">Founder ops copilot — answers cite live platform metrics only.</p>
        <p className="text-xs text-[#22D3EE]">
          Next scheduled brief:{" "}
          {nextBrief.toLocaleString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          })}{" "}
          IST
        </p>
        <div className="space-y-2">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              className="w-full text-left text-xs rounded border border-sa-border bg-sa-raised px-3 py-2 hover:border-sa-accent"
              onClick={() => void sendChat(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="pt-4 border-t border-sa-border space-y-2">
          <button
            type="button"
            className="text-xs text-sa-accent underline"
            onClick={() => void regenerateBrief()}
          >
            Regenerate daily brief
          </button>
          {brief && (
            <pre className="text-[10px] whitespace-pre-wrap text-sa-muted max-h-48 overflow-auto">
              {brief}
            </pre>
          )}
        </div>
        <div className="pt-4 border-t border-sa-border">
          <h3 className="text-xs font-medium text-sa-muted mb-2">Brief history</h3>
          <ul className="space-y-1">
            {briefHistory.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full text-left text-[10px] rounded border px-2 py-1.5 truncate ${
                    selectedBriefId === item.id
                      ? "border-sa-accent bg-sa-accent/10"
                      : "border-sa-border bg-sa-raised hover:border-sa-accent/50"
                  }`}
                  onClick={() => selectHistoryItem(item)}
                >
                  <span className="block truncate">
                    {new Date(item.generated_at).toLocaleDateString("en-IN")}
                  </span>
                  <span className="text-sa-muted capitalize">{item.delivery_status}</span>
                </button>
              </li>
            ))}
            {briefHistory.length === 0 && (
              <li className="text-[10px] text-sa-muted">No brief history yet</li>
            )}
          </ul>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 rounded-lg border border-sa-border bg-sa-raised">
        <div className="flex-1 overflow-y-auto p-4 text-sm whitespace-pre-wrap">
          {answer ? (
            <span className="text-[#22D3EE]">{answer}</span>
          ) : streaming ? (
            <span className="text-sa-muted">Thinking…</span>
          ) : (
            <span className="text-sa-muted">Select a chip or ask a question below.</span>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-sa-border p-3 flex gap-2">
          <input
            className="flex-1 rounded border border-sa-border bg-sa-surface px-3 py-2 text-sm"
            placeholder="Ask about MRR, churn, cron failures…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void sendChat(question)}
            disabled={streaming}
          />
          <button
            type="button"
            className="rounded bg-sa-accent px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={streaming || !question.trim()}
            onClick={() => void sendChat(question)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
