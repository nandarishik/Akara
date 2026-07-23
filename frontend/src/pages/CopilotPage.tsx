import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useCopilot } from "@/hooks/useCopilot";
import { useConversations } from "@/hooks/useConversations";
import { ChatBubble } from "@/components/copilot/ChatBubble";
import { SuggestedPrompts } from "@/components/copilot/SuggestedPrompts";
import { ConversationSidebar } from "@/components/copilot/ConversationSidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CopilotPage() {
  const {
    messages,
    isStreaming,
    conversationId,
    sendMessage,
    loadConversation,
    startNewConversation,
  } = useCopilot();
  const {
    conversations,
    renameConversation,
    deleteConversation,
    refetch,
  } = useConversations();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  async function handleDeleteConversation(id: string) {
    await deleteConversation(id);
    // If we deleted the active conversation, start a new one
    if (id === conversationId) {
      startNewConversation();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Full-width header — aligns with app shell, no staggered top bars */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-white min-h-[4.5rem]">
        <div>
          <h1 className="text-xl font-bold text-slate-900">AKARA Copilot</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ask anything about your sales data
          </p>
        </div>
        <Button onClick={handleNewChat} size="sm" variant="outline">
          + New Chat
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Hello! How can I help?
              </h2>
              <p className="text-slate-500 mt-2 max-w-md">
                I can answer questions about your revenue, orders, products,
                zones, and more.
              </p>
            </div>
            <SuggestedPrompts onSelect={(p) => { setInput(p); }} />
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-8 py-5 border-t border-slate-200 bg-white">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your sales data..."
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
          <p className="text-xs text-slate-400 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
