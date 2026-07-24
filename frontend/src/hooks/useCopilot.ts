import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
}

const BASE = import.meta.env.VITE_API_BASE_URL as string;

function parseStreamChunk(chunk: string): {
  kind: "conversation_id";
  id: string;
} | {
  kind: "error";
  message: string;
} | {
  kind: "text";
  text: string;
} {
  if (chunk.startsWith("{") && chunk.endsWith("}")) {
    try {
      const parsed = JSON.parse(chunk) as Record<string, unknown>;
      if (parsed.type === "conversation_id" && typeof parsed.id === "string") {
        return { kind: "conversation_id", id: parsed.id };
      }
      if (parsed.error || parsed.message) {
        return {
          kind: "error",
          message: String(parsed.message ?? parsed.error),
        };
      }
    } catch {
      /* treat as plain text */
    }
  }
  return { kind: "text", text: chunk };
}

export function useCopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    try {
      const res = await fetch(`${BASE}/copilot/conversations/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const loadedMessages = await res.json();
        setMessages(
          loadedMessages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
        setConversationId(id);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (question: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setError(null);

    let activeConversationId = conversationId;

    try {
      const res = await fetch(`${BASE}/copilot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          stream: true,
          conversation_id: conversationId,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const detail = errBody.detail;
        const msg =
          typeof detail === "string"
            ? detail
            : detail?.message ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const chunk = line.slice(6);
          if (chunk === "[DONE]") continue;

          const parsed = parseStreamChunk(chunk);
          if (parsed.kind === "conversation_id") {
            activeConversationId = parsed.id;
            setConversationId(parsed.id);
            continue;
          }
          if (parsed.kind === "error") {
            setError(parsed.message);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: parsed.message,
                      streaming: false,
                      error: true,
                    }
                  : m
              )
            );
            continue;
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + parsed.text }
                : m
            )
          );
        }
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMsgId) return m;
          if (!m.content.trim()) {
            return {
              ...m,
              content: "Sorry, something went wrong. Please try again.",
              streaming: false,
              error: true,
            };
          }
          return { ...m, streaming: false };
        })
      );

      if (activeConversationId) {
        setConversationId(activeConversationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: "Sorry, something went wrong. Please try again.",
                streaming: false,
                error: true,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [conversationId]);

  return {
    messages,
    isStreaming,
    conversationId,
    error,
    sendMessage,
    loadConversation,
    startNewConversation,
  };
}
