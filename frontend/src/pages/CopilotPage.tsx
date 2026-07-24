import { useEffect, useRef, useState } from "react";
import {
  Send,
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  Plus,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCopilot } from "@/hooks/useCopilot";
import { useConversations } from "@/hooks/useConversations";
import { useBilling } from "@/hooks/useBilling";
import {
  getQuotaLevel,
  getUsagePct,
  getMonthResetDate,
} from "@/lib/api/billing";
import { AkaraButton } from "@/components/ui/GradientButton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

const SUGGESTED_PROMPTS = [
  "Show me top routes by revenue",
  "Which parties have outstanding credit?",
  "What was my monthly sales trend?",
];

export function CopilotPage() {
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
  const [input, setInput] = useState("");
  const [feedbackStates, setFeedbackStates] = useState<
    Record<string, "positive" | "negative" | null>
  >({});
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("connected");
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
    await sendMessage(q);
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
    <div className="flex flex-col h-full min-h-0 bg-surface-canvas">
      {/* Compact header — quota lives here, not in global shell banner */}
      <div className="px-4 lg:px-6 py-3 border-b border-surface-border bg-surface-card shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent text-white shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-h2 text-base">AKARA Copilot</h1>
              <div className="flex items-center gap-2 text-caption">
                {connectionStatus === "connected" ? (
                  <Wifi className="h-3 w-3 text-green-600" />
                ) : (
                  <WifiOff className="h-3 w-3 text-red-500" />
                )}
                <span>Ask anything about your sales data</span>
              </div>
            </div>
          </div>
          <AkaraButton size="sm" onClick={handleNewChat} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            New chat
          </AkaraButton>
        </div>

        {connectionStatus === "disconnected" && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            AI is temporarily unavailable. Your dashboard and data still work — try again in a few minutes.
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
              <div className="h-1 rounded-full bg-surface-raised overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    quotaLevel === "blocked" ? "bg-red-500" : "bg-accent"
                  )}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
            </div>
            <span className="text-text-muted shrink-0 hidden sm:inline">
              {questionsLeft} left · {getMonthResetDate()}
            </span>
            {quotaLevel === "critical" || quotaLevel === "blocked" ? (
              <Link to="/upgrade" className="text-accent font-semibold shrink-0 hover:underline">
                Upgrade
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conversation sidebar — ChatGPT-style history */}
        <div className="w-64 lg:w-72 border-r border-surface-border bg-surface-card flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-surface-border">
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <MessageSquare className="h-4 w-4 text-accent" />
              Chat history
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversationsLoading ? (
              <p className="text-caption text-center py-6">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="text-caption text-center py-6 px-2">
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
                      ? "bg-accent-soft text-accent font-medium"
                      : "text-text-primary hover:bg-surface-raised"
                  )}
                >
                  <p className="truncate font-medium">
                    {conv.title || "New conversation"}
                  </p>
                  <p className="text-caption text-xs mt-0.5 truncate">
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
                <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center text-accent mb-4">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-h2">Ask AKARA anything</h2>
                <p className="text-body text-sm mt-2">
                  Type a question below or pick a suggestion to get started.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      disabled={isStreaming}
                      className="px-3 py-2 text-sm rounded-full border border-surface-border bg-surface-card text-text-secondary hover:border-accent hover:text-accent transition-colors"
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
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center",
                        m.role === "user"
                          ? "bg-accent text-white"
                          : "bg-surface-raised border border-surface-border text-accent"
                      )}
                    >
                      {m.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[85%]",
                        m.role === "user"
                          ? "bg-accent-soft text-text-primary border border-accent/20"
                          : "bg-surface-card border border-surface-border text-text-primary",
                        m.error && "border-red-200 bg-red-50"
                      )}
                    >
                      {m.content || (m.streaming ? "…" : "")}
                      {m.role === "assistant" && !m.streaming && m.content && (
                        <div className="mt-3 pt-2 border-t border-surface-border flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleFeedback(m.id, 1)}
                            className={cn(
                              "p-1 rounded",
                              feedbackStates[m.id] === "positive"
                                ? "text-green-600 bg-green-50"
                                : "text-text-muted hover:text-green-600"
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
                                ? "text-red-600 bg-red-50"
                                : "text-text-muted hover:text-red-600"
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
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center text-accent">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-xl px-4 py-3 bg-surface-card border border-surface-border text-text-muted text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Thinking…
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="px-4 lg:px-8 pb-2">
              <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}

          <div className="px-4 lg:px-8 py-4 border-t border-surface-border bg-surface-card shrink-0">
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your revenue, orders, customers…"
                rows={1}
                className="resize-none min-h-[44px] max-h-32 flex-1 bg-white border-surface-border"
                disabled={isStreaming || connectionStatus === "disconnected"}
              />
              <AkaraButton
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                size="sm"
                className="h-11 w-11 p-0 shrink-0"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </AkaraButton>
            </div>
            <p className="text-caption text-center mt-2 max-w-3xl mx-auto">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
