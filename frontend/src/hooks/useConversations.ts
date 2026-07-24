import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

const BASE = import.meta.env.VITE_API_BASE_URL as string;

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch(`${BASE}/copilot/conversations/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const list = await res.json();
      setConversations(Array.isArray(list) ? list : []);
    }
    setLoading(false);
  }, []);

  const createConversation = useCallback(async (title = "New Chat") => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;

    const res = await fetch(`${BASE}/copilot/conversations/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const newConv = await res.json();
      setConversations((prev) => [newConv, ...prev]);
      return newConv;
    }
    return null;
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch(`${BASE}/copilot/conversations/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const updated = await res.json();
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch(`${BASE}/copilot/conversations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    createConversation,
    renameConversation,
    deleteConversation,
    refetch: fetchConversations,
  };
}
