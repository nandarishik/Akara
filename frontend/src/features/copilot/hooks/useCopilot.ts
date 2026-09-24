import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

import type { CopilotEvidencePayload } from "../components/CopilotEvidence";

export type StreamPhase = "planning" | "querying" | "composing" | null;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
  evidence?: CopilotEvidencePayload | null;
  langfuse_trace_id?: string | null;
  message_id?: string | null;
}

const BASE = import.meta.env.VITE_API_BASE_URL as string;
const STREAM_TIMEOUT_MS = 30_000;

export type ParsedChunk =
  | { kind: "conversation_id"; id: string }
  | { kind: "error"; message: string; llm_available?: boolean }
  | { kind: "phase"; phase: StreamPhase }
  | { kind: "evidence"; evidence: CopilotEvidencePayload; meta: Record<string, unknown> }
  | { kind: "text"; text: string };

export function parseStreamChunk(chunk: string): ParsedChunk {
  if (chunk.startsWith("{") && chunk.endsWith("}")) {
    try {
      const parsed = JSON.parse(chunk) as Record<string, unknown>;
      if (parsed.type === "conversation_id" && typeof parsed.id === "string") {
        return { kind: "conversation_id", id: parsed.id };
      }
      if (parsed.type === "phase") {
        const phase = parsed.phase;
        if (phase === "planning" || phase === "querying" || phase === "composing") {
          return { kind: "phase", phase };
        }
      }
      if (parsed.type === "evidence" && parsed.evidence && typeof parsed.evidence === "object") {
        return {
          kind: "evidence",
          evidence: parsed.evidence as CopilotEvidencePayload,
          meta: parsed,
        };
      }
      if (parsed.error || parsed.message) {
        return {
          kind: "error",
          message: String(parsed.message ?? parsed.error),
          llm_available: parsed.llm_available === false ? false : undefined,
        };
      }
    } catch {
      /* treat as plain text */
    }
  }
  return { kind: "text", text: chunk };
}

export function useCopilot() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
          loadedMessages.map(
            (m: {
              id: string;
              role: string;
              content: string;
              evidence?: CopilotEvidencePayload;
            }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              evidence: m.evidence ?? null,
            }),
          ),
        );
        setConversationId(id);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setError(null);
    setStreamPhase(null);
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (question: string, reportId?: string | null) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const trimmed = question.slice(0, 2000);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
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
      setStreamPhase("planning");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

      let activeConversationId = conversationId;
      let chatSucceeded = false;

      try {
        const res = await fetch(`${BASE}/copilot/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question: trimmed,
            stream: true,
            conversation_id: conversationId,
            report_id: reportId ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const detail = (errBody as { detail?: unknown }).detail;
          const msg =
            typeof detail === "string"
              ? detail
              : (detail as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
          throw new Error(msg);
        }

        chatSucceeded = true;
        void queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });

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
            if (parsed.kind === "phase") {
              setStreamPhase(parsed.phase);
              continue;
            }
            if (parsed.kind === "evidence") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        evidence: parsed.evidence,
                        langfuse_trace_id:
                          typeof parsed.meta.langfuse_trace_id === "string"
                            ? parsed.meta.langfuse_trace_id
                            : m.langfuse_trace_id,
                        message_id:
                          typeof parsed.meta.message_id === "string"
                            ? parsed.meta.message_id
                            : m.message_id,
                      }
                    : m,
                ),
              );
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
                    : m,
                ),
              );
              continue;
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + parsed.text } : m,
              ),
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
          }),
        );

        if (activeConversationId) {
          setConversationId(activeConversationId);
        }
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        const msg = aborted
          ? "Request timed out. You can cancel and try again."
          : err instanceof Error
            ? err.message
            : String(err);
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: aborted
                    ? "Request timed out after 30s. Please try again."
                    : "Sorry, something went wrong. Please try again.",
                  streaming: false,
                  error: true,
                }
              : m,
          ),
        );
      } finally {
        window.clearTimeout(timeoutId);
        abortRef.current = null;
        setIsStreaming(false);
        setStreamPhase(null);
        if (chatSucceeded) {
          void queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
        }
      }
    },
    [conversationId, queryClient],
  );

  return {
    messages,
    isStreaming,
    streamPhase,
    conversationId,
    error,
    sendMessage,
    loadConversation,
    startNewConversation,
    cancelStream,
  };
}
