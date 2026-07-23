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

/** Parse one SSE event block (lines between blank-line separators). */
function parseSseEvent(block: string): string | null {
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  return dataLines.length > 0 ? dataLines.join("\n") : null;
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (body?.detail?.message) return String(body.detail.message);
    return JSON.stringify(body.detail ?? body);
  } catch {
    try {
      return (await res.text()) || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

export function useCopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

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
          loadedMessages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
        setConversationId(id);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
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
        const detail = await readErrorDetail(res);
        throw new Error(detail || `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response body from server");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";

        for (const event of events) {
          const chunk = parseSseEvent(event);
          if (!chunk || chunk === "[DONE]") continue;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        }
      }

      // Flush any trailing partial event
      if (buffer.trim()) {
        const chunk = parseSseEvent(buffer);
        if (chunk && chunk !== "[DONE]") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + chunk }
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
              content:
                "Sorry, something went wrong. The server returned an empty response. Check that the backend is running and OPENROUTER_API_KEY is set.",
              streaming: false,
              error: true,
            };
          }
          return { ...m, streaming: false };
        })
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      const friendly =
        message === "Failed to fetch"
          ? `Cannot reach the API at ${BASE}. If you're running locally, start the backend or set VITE_API_BASE_URL to your Railway URL.`
          : message;
      console.error("Copilot chat failed:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: friendly,
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
    sendMessage,
    loadConversation,
    startNewConversation,
  };
}
