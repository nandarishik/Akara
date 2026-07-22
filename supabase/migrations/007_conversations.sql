-- conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL DEFAULT 'New Chat',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON public.conversations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations (updated_at DESC);

ALTER TABLE public.chat_history 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_history_conversation_id ON public.chat_history (conversation_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;

CREATE POLICY "conversations_select"
    ON public.conversations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "conversations_insert"
    ON public.conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_update"
    ON public.conversations FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "conversations_delete"
    ON public.conversations FOR DELETE
    USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_conversations_with_counts(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    message_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        COALESCE(COUNT(ch.id), 0) as message_count
    FROM public.conversations c
    LEFT JOIN public.chat_history ch ON ch.conversation_id = c.id
    WHERE c.user_id = p_user_id
    GROUP BY c.id, c.title, c.created_at, c.updated_at
    ORDER BY c.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.get_conversations_with_counts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conversations_with_counts(UUID) TO service_role;