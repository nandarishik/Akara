import { useEffect, useRef, useState } from "react";
import {
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  Plus,
  MessageSquare,
  AlertCircle,
  Wifi,
  WifiOff,
  Menu,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCopilot } from "@/features/copilot/hooks/useCopilot";
import { useConversations } from "@/features/copilot/hooks/useConversations";
import { useBilling } from "@/features/billing/hooks/useBilling";
import {
  getQuotaLevel,
  getUsagePct,
  getMonthResetDate,
} from "@/lib/api/billing";
import CopilotStrandsLoader from "@/features/copilot/components/CopilotStrandsLoader";
import AITextLoading from "@/features/copilot/components/AITextLoading";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import ShimmerSkeleton from "@/shared/ui/ShimmerSkeleton";
import { Textarea } from "@/shared/ui/textarea";
import { toast } from "@/shared/ui/toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { MobileHistoryDrawer } from "@/features/copilot/components/MobileHistoryDrawer";
import { ChatMarkdown } from "@/features/copilot/components/ChatMarkdown";
import { GlassIcon } from "@/shared/effects/GlassIcon";
import { useMobileNav } from "@/shared/layout/MobileNavContext";
import { PromoDismissCard } from "@/shared/PromoDismissCard";
import {
  dismissSlot,
  incrementVisitCount,
  isSlotDismissed,
  PLACEMENT_KEYS,
  SLOT_KEYS,
} from "@/lib/promoSlots";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

const SUGGESTED_PROMPTS = [
  "Show me top routes by revenue",
  "Which parties have outstanding credit?",
  "What was my monthly sales trend?",
];

export function CopilotPage() {
  const location = useLocation();
  const debriefReportId = (location.state as { debriefReportId?: string } | null)
    ?.debriefReportId;
  const {
    messages,
    isStreaming,
    conversationId,
    sendMessage,
    loadConversation,
    startNewConversation,
    error,
  } = useCopilot();
  const { conversations, loading: conversationsLoading, refetch } = useConversations();
  const { data: usage } = useBilling();
  const [input, setInput] = useState(
    debriefReportId ? "What should I prioritize from this week's debrief?" : ""
  );
  const [feedbackStates, setFeedbackStates] = useState<
    Record<string, "positive" | "negative" | null>
  >({});
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("connected");
  const [showHistory, setShowHistory] = useState(false);
  const [showDemoSlot, setShowDemoSlot] = useState(false);
  const openMobileNav = useMobileNav();
  const bottomRef = useRef<HTMLDivElement>(null);

  const quotaLevel = usage
    ? getQuotaLevel(usage.copilot_calls_used, usage.copilot_calls_limit)
    : "ok";
  const quotaPct = usage
    ? getUsagePct(usage.copilot_calls_used, usage.copilot_calls_limit)
    : 0;
  const questionsLeft = usage
    ? Math.max(
        0,
        usage.copilot_calls_limit === -1
          ? Infinity
          : usage.copilot_calls_limit - usage.copilot_calls_used
      )
    : 0;

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (error) {
      if (error.includes("503") || error.includes("timeout") || error.includes("ai_unavailable")) {
        setConnectionStatus("disconnected");
      } else if (error.includes("429") || error.includes("RATE_LIMITED")) {
        setConnectionStatus("reconnecting");
      }
    } else {
      setConnectionStatus("connected");
    }
  }, [error]);

  useEffect(() => {
    if (isSlotDismissed(SLOT_KEYS.F)) return;
    const views = incrementVisitCount(SLOT_KEYS.F_VIEWS);
    if (views >= 3) setShowDemoSlot(true);
  }, []);

  async function handleFeedback(messageId: string, rating: 1 | -1) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(`${API_BASE}/copilot/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_id: messageId,
          rating,
        }),
      });

      if (response.ok) {
        setFeedbackStates((prev) => ({
          ...prev,
          [messageId]: rating === 1 ? "positive" : "negative",
        }));
        toast.success(
          rating === 1 ? "Thanks for the feedback!" : "Thanks — we'll improve."
        );
      } else {
        toast.error("Failed to submit feedback");
      }
    } catch (err) {
      console.error("Feedback error:", err);
      toast.error("Failed to submit feedback");
    }
  }

  async function handleSend(text?: string) {
    const q = (text ?? input).trim();
    if (!q || isStreaming) return;
    setInput("");
    await sendMessage(q, debriefReportId ?? null);
    setTimeout(() => refetch(), 600);
  }

  function handleNewChat() {
    startNewConversation();
  }

  async function handleSelectConversation(id: string) {
    await loadConversation(id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative z-10">
      <div className="px-4 lg:px-6 py-3 border-b border-white/10 bg-[#0a0a0a]/80 shrink-0">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {openMobileNav && (
              <button
                type="button"
                onClick={openMobileNav}
                className="md:hidden p-2 -ml-1 rounded-lg text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="md:hidden p-2 rounded-lg text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              aria-label="Open chat history"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#03B3C3]/20 text-[#03B3C3] shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold truncate text-white">AKARA Copilot</h1>
              <div className="flex items-center gap-2 text-xs text-white/50 min-w-0">
                {connectionStatus === "connected" ? (
                  <Wifi className="h-3 w-3 text-green-600 shrink-0" />
                ) : (
                  <WifiOff className="h-3 w-3 text-red-500 shrink-0" />
                )}
                <span className="truncate hidden sm:inline">
                  {debriefReportId
                    ? "Discussing your weekly debrief"
                    : "Ask anything about your sales data"}
                </span>
              </div>
            </div>
          </div>
          <GlowCTAButton size="sm" onClick={handleNewChat} className="shrink-0 min-h-[44px]">
            <Plus className="h-4 w-4 sm:mr-1 inline" />
            New chat
          </GlowCTAButton>
        </div>

        {connectionStatus === "disconnected" && (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            AI is temporarily unavailable. Your dashboard and data still work — try again in a few minutes.
          </div>
        )}

        {showDemoSlot && (
          <div className="mt-3">
            <PromoDismissCard
              slotKey={PLACEMENT_KEYS.F}
              title="See Copilot in action"
              description="Watch a 2-minute demo of revenue questions, route analysis, and debrief follow-ups."
              ctaLabel="View demo →"
              ctaTo="/reports"
              accent="blue"
              onDismiss={() => {
                dismissSlot(SLOT_KEYS.F);
                setShowDemoSlot(false);
              }}
            />
          </div>
        )}

        {usage && usage.copilot_calls_limit !== -1 && (
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-caption mb-1">
                <span>Questions this month</span>
                <span className="tabular-nums">
                  {usage.copilot_calls_used}/{usage.copilot_calls_limit}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    quotaLevel === "blocked" ? "bg-red-500" : "bg-[#03B3C3]"
                  )}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
            </div>
            <span className="text-text-muted shrink-0 hidden sm:inline">
              {questionsLeft} left · {getMonthResetDate()}
            </span>
            {quotaLevel === "critical" || quotaLevel === "blocked" ? (
              <Link to="/upgrade" className="text-[#03B3C3] font-semibold shrink-0 hover:underline">
                Upgrade
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <MobileHistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={conversations}
        loading={conversationsLoading}
        conversationId={conversationId}
        onSelect={handleSelectConversation}
      />

      <div className="flex flex-1 min-h-0">
        {/* Conversation sidebar — desktop only */}
        <div className="hidden md:flex w-64 lg:w-72 border-r border-white/10 bg-[#0a0a0a]/60 flex-col shrink-0">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm font-medium text-white/70">
              <MessageSquare className="h-4 w-4 text-[#03B3C3]" />
              Chat history
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversationsLoading ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <ShimmerSkeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-center py-6 px-2 text-white/45">
                Past chats appear here after you send a message.
              </p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                    conv.id === conversationId
                      ? "bg-[#03B3C3]/15 text-[#03B3C3] font-medium"
                      : "text-white/80 hover:bg-white/5"
                  )}
                >
                  <p className="truncate font-medium">
                    {conv.title || "New conversation"}
                  </p>
                  <p className="text-xs mt-0.5 truncate text-white/40">
                    {new Date(conv.updated_at ?? conv.created_at).toLocaleDateString()}
                    {conv.message_count > 0 && ` · ${conv.message_count} msgs`}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main chat */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
                <h2 className="text-xl font-semibold text-white">Ask AKARA anything</h2>
                <p className="text-sm mt-2 text-white/60">
                  Type a question below or pick a suggestion to get started.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      disabled={isStreaming}
                      className="px-3 py-2 text-sm rounded-full border border-white/15 bg-white/5 text-white/70 hover:border-[#03B3C3]/50 hover:text-[#03B3C3] transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-3",
                      m.role === "user" && "flex-row-reverse"
                    )}
                  >
                    <GlassIcon
                      decorative
                      size="sm"
                      color={m.role === "user" ? "blue" : "purple"}
                      icon={
                        m.role === "user" ? (
                          <User className="h-3.5 w-3.5" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" />
                        )
                      }
                      label={m.role === "user" ? "You" : "AKARA"}
                    />
                    <div
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[85%]",
                        m.role === "user"
                          ? "bg-[#03B3C3]/15 text-white border border-[#03B3C3]/25"
                          : "bg-[#0a0a0a]/80 border border-white/10 text-white/90",
                        m.error && "border-red-400/40 bg-red-500/10"
                      )}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content || ""}</p>
                      ) : m.content ? (
                        <>
                          <ChatMarkdown content={m.content} />
                          {m.streaming && (
                            <span className="inline-block w-1 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
                          )}
                        </>
                      ) : m.streaming ? (
                        <span className="text-white/40">…</span>
                      ) : null}
                      {m.role === "assistant" && !m.streaming && m.content && (
                        <div className="mt-3 pt-2 border-t border-white/10 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleFeedback(m.id, 1)}
                            className={cn(
                              "p-1 rounded",
                              feedbackStates[m.id] === "positive"
                                ? "text-emerald-400 bg-emerald-400/10"
                                : "text-white/40 hover:text-emerald-400"
                            )}
                            aria-label="Helpful"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(m.id, -1)}
                            className={cn(
                              "p-1 rounded",
                              feedbackStates[m.id] === "negative"
                                ? "text-red-400 bg-red-400/10"
                                : "text-white/40 hover:text-red-400"
                            )}
                            aria-label="Not helpful"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isStreaming && (
                  <div className="flex gap-3 items-center">
                    <GlassIcon
                      decorative
                      size="sm"
                      color="purple"
                      icon={<Bot className="h-3.5 w-3.5" />}
                      label="AKARA"
                    />
                    <div className="rounded-xl px-4 py-3 bg-[#0a0a0a]/80 border border-white/10 text-white/60 text-sm flex items-center min-w-[200px]">
                      <AITextLoading compact />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="px-4 lg:px-8 pb-2">
              <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}

          <div className="px-4 lg:px-8 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-[#0a0a0a]/90 shrink-0">
            {quotaLevel === "blocked" && !isSlotDismissed(SLOT_KEYS.L) && (
              <div className="max-w-3xl mx-auto mb-3">
                <PromoDismissCard
                  slotKey={PLACEMENT_KEYS.L}
                  title="Monthly Copilot quota reached"
                  description="Upgrade to Pro for 500 questions/month and unlock scheme leakage reports."
                  ctaLabel="Upgrade plan →"
                  ctaTo="/upgrade"
                  accent="amber"
                  onDismiss={() => dismissSlot(SLOT_KEYS.L)}
                />
              </div>
            )}
            <div className="max-w-3xl mx-auto flex gap-3 items-end">
              <CopilotStrandsLoader variant="companion" active={isStreaming} />
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your revenue, orders, customers…"
                rows={1}
                className="resize-none min-h-[44px] max-h-32 flex-1 bg-white/5 border-white/15 text-white placeholder:text-white/35"
                disabled={isStreaming || connectionStatus === "disconnected"}
              />
              <GlowCTAButton
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                size="sm"
                className="h-11 w-11 p-0 shrink-0"
              >
                Send
              </GlowCTAButton>
            </div>
            <p className="text-xs text-center mt-2 max-w-3xl mx-auto text-white/40">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
