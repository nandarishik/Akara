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
  Clock,
  Database,
  AlertCircle,
  Wifi,
  WifiOff
} from "lucide-react";
import { useCopilot } from "@/hooks/useCopilot";
import { useConversations } from "@/hooks/useConversations";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";
import GradientButton, { SecondaryButton } from "@/components/ui/GradientButton";
import { CopilotEmptyState } from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

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
  const {
    conversations,
    refetch,
  } = useConversations();
  const [input, setInput] = useState("");
  const [feedbackStates, setFeedbackStates] = useState<Record<string, 'positive' | 'negative' | null>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Simulate connection status based on errors
  useEffect(() => {
    if (error) {
      if (error.includes('503') || error.includes('timeout')) {
        setConnectionStatus('disconnected');
      } else if (error.includes('429')) {
        setConnectionStatus('reconnecting');
      }
    } else {
      setConnectionStatus('connected');
    }
  }, [error]);

  async function handleFeedback(messageId: string, rating: 1 | -1, comment?: string) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(`${API_BASE}/copilot/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_id: messageId,
          rating,
          comment
        })
      });

      if (response.ok) {
        setFeedbackStates(prev => ({
          ...prev,
          [messageId]: rating === 1 ? 'positive' : 'negative'
        }));
        toast.success(rating === 1 ? 'Thanks for the positive feedback!' : 'Thanks for helping us improve!');
      } else {
        toast.error('Failed to submit feedback');
      }
    } catch (err) {
      console.error('Feedback error:', err);
      toast.error('Failed to submit feedback');
    }
  }

  async function handleSend() {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    await sendMessage(q);
    // Refetch conversations to update the list with the new/updated conversation
    setTimeout(() => refetch(), 500);
  }

  async function handleNewChat() {
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
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Navy Glass Header */}
      <LiquidGlassCard hover={false} className="px-6 py-4 border-b border-[rgba(33,150,243,0.08)] shrink-0 rounded-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                boxShadow: '0 8px 32px rgba(66, 165, 245, 0.3)'
              }}
            >
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 
                className="text-xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
                }}
              >
                AKARA Copilot
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {connectionStatus === 'connected' ? (
                  <Wifi className="h-3 w-3 text-emerald-400" />
                ) : connectionStatus === 'disconnected' ? (
                  <WifiOff className="h-3 w-3 text-red-400" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-amber-400 animate-pulse" />
                )}
                <p className="text-sm text-[#90CAF9]">
                  Ask anything about your sales data
                </p>
              </div>
            </div>
          </div>
          <GradientButton size="sm" onClick={handleNewChat}>
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </GradientButton>
        </div>
      </LiquidGlassCard>

      {/* Body: Navy Glass Sidebar + Chat */}
      <div className="flex flex-1 min-h-0">
        {/* Navy Glass Conversation Sidebar */}
        <div className="w-80 h-full border-r border-[rgba(33,150,243,0.08)]" style={{ backgroundColor: '#051B37' }}>
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-[#42A5F5]" />
              <span className="text-[#90CAF9] font-medium">Conversations</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {conversations.length === 0 ? (
                <div className="text-center text-[#5C8FBF] text-sm mt-8">
                  Start your first conversation
                </div>
              ) : (
                conversations.map((conv, i) => (
                  <LiquidGlassCard
                    key={conv.id}
                    hover={true}
                    className={`p-3 cursor-pointer transition-all duration-200 animate-fadeInUp ${
                      conv.id === conversationId 
                        ? 'border-[#42A5F5]/30 bg-[rgba(66,165,245,0.1)]' 
                        : 'border-[rgba(33,150,243,0.08)]'
                    }`}
                    style={{
                      animationDelay: `${i * 50}ms`
                    }}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E3F2FD] font-medium text-sm truncate">
                          {conv.title || 'New conversation'}
                        </p>
                        <p className="text-[#90CAF9] text-xs mt-1">
                          {new Date(conv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {conv.id === conversationId && (
                        <div className="w-2 h-2 rounded-full bg-[#42A5F5] flex-shrink-0 ml-2 animate-pulse" />
                      )}
                    </div>
                  </LiquidGlassCard>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <CopilotEmptyState />
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto">
                {messages.map((m, index) => (
                  <div
                    key={m.id}
                    className={`flex gap-4 animate-fadeInUp ${
                      m.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                    style={{
                      animationDelay: `${index * 100}ms`
                    }}
                  >
                    {/* Avatar */}
                    <div 
                      className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${
                        m.role === 'user' 
                          ? 'bg-gradient-to-br from-[#1565C0] to-[#42A5F5] text-white'
                          : 'bg-[rgba(15,52,96,0.6)] border border-[rgba(33,150,243,0.12)] text-[#42A5F5]'
                      }`}
                      style={{
                        boxShadow: m.role === 'user' 
                          ? '0 4px 16px rgba(66, 165, 245, 0.3)' 
                          : '0 4px 16px rgba(15, 52, 96, 0.2)'
                      }}
                    >
                      {m.role === 'user' ? (
                        <User className="h-5 w-5" />
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div className="flex-1 min-w-0">
                      <LiquidGlassCard 
                        hover={false}
                        className={`p-4 ${
                          m.role === 'user'
                            ? 'ml-auto max-w-2xl border-l-4 border-l-[#42A5F5] bg-gradient-to-r from-[rgba(66,165,245,0.05)] to-transparent'
                            : 'mr-auto max-w-3xl border-l-4 border-l-[#1565C0]'
                        }`}
                      >
                        <div className={`text-sm leading-relaxed ${
                          m.role === 'user' 
                            ? 'text-[#E3F2FD]' 
                            : 'text-[#F0F8FF]'
                        }`}>
                          {m.content}
                        </div>

                        {/* AI message footer with feedback and provenance */}
                        {m.role === 'assistant' && (
                          <div className="mt-4 pt-3 border-t border-[rgba(33,150,243,0.08)]">
                            <div className="flex items-center justify-between">
                              {/* Data Provenance */}
                              <div className="flex items-center gap-3 text-xs text-[#90CAF9]">
                                <div className="flex items-center gap-1">
                                  <Database className="h-3 w-3" />
                                  <span>1,247 rows</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>2024-03-15</span>
                                </div>
                              </div>

                              {/* Feedback Buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleFeedback(m.id, 1)}
                                  className={`p-1 rounded transition-all ${
                                    feedbackStates[m.id] === 'positive'
                                      ? 'text-emerald-400 bg-emerald-400/10'
                                      : 'text-[#5C8FBF] hover:text-emerald-400 hover:bg-emerald-400/5'
                                  }`}
                                  title="Helpful"
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleFeedback(m.id, -1)}
                                  className={`p-1 rounded transition-all ${
                                    feedbackStates[m.id] === 'negative'
                                      ? 'text-red-400 bg-red-400/10'
                                      : 'text-[#5C8FBF] hover:text-red-400 hover:bg-red-400/5'
                                  }`}
                                  title="Not helpful"
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </LiquidGlassCard>
                    </div>
                  </div>
                ))}
                
                {/* Streaming indicator */}
                {isStreaming && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center bg-[rgba(15,52,96,0.6)] border border-[rgba(33,150,243,0.12)] text-[#42A5F5]">
                      <Bot className="h-5 w-5" />
                    </div>
                    <LiquidGlassCard hover={false} className="p-4 max-w-3xl border-l-4 border-l-[#1565C0]">
                      <div className="flex items-center gap-2 text-[#90CAF9]">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    </LiquidGlassCard>
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error States */}
          {error && (
            <div className="px-8 py-4">
              <LiquidGlassCard className="p-4 border-red-500/20 bg-red-500/5 max-w-3xl mx-auto">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div>
                    {error.includes('503') ? (
                      <div>
                        <p className="text-red-400 font-medium">AI is temporarily unavailable</p>
                        <p className="text-red-300 text-sm">Please try again in a few moments</p>
                      </div>
                    ) : error.includes('429') ? (
                      <div>
                        <p className="text-amber-400 font-medium">AI is temporarily busy</p>
                        <p className="text-amber-300 text-sm">Too many requests - please wait a moment</p>
                      </div>
                    ) : error.includes('timeout') || error.includes('504') ? (
                      <div>
                        <p className="text-orange-400 font-medium">Response timeout</p>
                        <p className="text-orange-300 text-sm">The question is taking too long - try something simpler</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-red-400 font-medium">Something went wrong</p>
                        <p className="text-red-300 text-sm">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
              </LiquidGlassCard>
            </div>
          )}

          {/* Navy Glass Input Area */}
          <div className="px-8 py-5 border-t border-[rgba(33,150,243,0.08)] shrink-0">
            <LiquidGlassCard hover={false} className="p-4 max-w-4xl mx-auto">
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your revenue, orders, customers..."
                  rows={1}
                  className="resize-none min-h-[44px] max-h-32 bg-transparent border-[rgba(33,150,243,0.12)] text-[#E3F2FD] placeholder:text-[#5C8FBF] focus:border-[#42A5F5] focus:ring-0"
                  disabled={isStreaming || connectionStatus === 'disconnected'}
                />
                <GradientButton
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || connectionStatus === 'disconnected'}
                  size="sm"
                  className="h-11 w-11 flex-shrink-0 p-0"
                >
                  <Send className="h-4 w-4" />
                </GradientButton>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-[#90CAF9]">
                <span>Press Enter to send · Shift+Enter for new line</span>
                <div className="flex items-center gap-2">
                  {connectionStatus === 'connected' ? (
                    <span className="text-emerald-400">Connected</span>
                  ) : connectionStatus === 'disconnected' ? (
                    <span className="text-red-400">Disconnected</span>
                  ) : (
                    <span className="text-amber-400">Reconnecting...</span>
                  )}
                </div>
              </div>
            </LiquidGlassCard>
          </div>
        </div>
      </div>

      {/* Ad Slot F - AI Enhancement Prompt */}
      <div className="absolute bottom-24 right-8">
        <LiquidGlassCard className="p-4 border-[#42A5F5]/20 w-80 animate-fadeInUp">
          <div className="flex items-start gap-3">
            <div 
              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                boxShadow: '0 4px 16px rgba(66, 165, 245, 0.3)'
              }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <h4 
                className="font-semibold bg-clip-text text-transparent text-sm mb-1"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
                }}
              >
                AI Enhancement Available
              </h4>
              <p className="text-[#90CAF9] text-xs mb-3">
                Get advanced analytics with our Pro AI models
              </p>
              <SecondaryButton size="sm" className="w-full">
                Upgrade AI
              </SecondaryButton>
            </div>
          </div>
        </LiquidGlassCard>
      </div>
    </div>
  );
}
