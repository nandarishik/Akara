from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client

router = APIRouter(prefix="/copilot/conversations", tags=["copilot"])


class ConversationOut(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ConversationCreate(BaseModel):
    title: str = "New Chat"


class ConversationUpdate(BaseModel):
    title: str


class MessageOut(BaseModel):
    id: str
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime


@router.get("/", response_model=list[ConversationOut])
def list_conversations(
    user: CurrentUser,
    tenant: TenantCtx,
) -> list[ConversationOut]:
    """List all non-deleted conversations for the current user, sorted by most recent."""
    supabase = get_supabase_service_client()

    # Day 4: Exclude soft-deleted conversations
    # Note: We assume the get_conversations_with_counts RPC function
    # should be updated to exclude deleted_at IS NOT NULL
    # For now, we'll use a direct query if the RPC doesn't handle soft deletes
    try:
        result = supabase.rpc(
            "get_conversations_with_counts",
            {"p_user_id": str(user.user_id)}
        ).execute()

        # Filter out deleted conversations client-side if RPC doesn't handle it
        conversations = result.data or []
        # Filter out any that have deleted_at (if the field is returned)
        conversations = [conv for conv in conversations if not conv.get('deleted_at')]

        return [ConversationOut(**row) for row in conversations]
    except Exception:
        # Fallback to direct query if RPC fails
        result = (
            supabase.table("conversations")
            .select("id, title, created_at, updated_at")
            .eq("user_id", str(user.user_id))
            .is_("deleted_at", "null")
            .order("updated_at", desc=True)
            .execute()
        )
        return [ConversationOut(**row, message_count=0) for row in (result.data or [])]


@router.post("/", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    body: ConversationCreate,
    user: CurrentUser,
    tenant: TenantCtx,
) -> ConversationOut:
    """Create a new conversation."""
    supabase = get_supabase_service_client()
    result = (
        supabase.table("conversations")
        .insert({
            "tenant_id": str(tenant.tenant_id),
            "user_id": str(user.user_id),
            "title": body.title,
        })
        .execute()
    )
    conv = result.data[0]
    return ConversationOut(**conv, message_count=0)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def get_conversation_messages(
    conversation_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> list[MessageOut]:
    """Load all messages for a conversation."""
    supabase = get_supabase_service_client()

    # Verify ownership
    conv_check = (
        supabase.table("conversations")
        .select("id")
        .eq("id", str(conversation_id))
        .eq("user_id", str(user.user_id))
        .execute()
    )
    if not conv_check.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    result = (
        supabase.table("chat_history")
        .select("id, question, response, created_at")
        .eq("conversation_id", str(conversation_id))
        .order("created_at", desc=False)
        .execute()
    )

    messages = []
    for row in result.data or []:
        messages.append(MessageOut(
            id=str(row["id"]),
            role="user",
            content=row["question"],
            created_at=row["created_at"],
        ))
        if row["response"]:
            messages.append(MessageOut(
                id=f"{row['id']}-assistant",
                role="assistant",
                content=row["response"],
                created_at=row["created_at"],
            ))

    return messages


@router.patch("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: UUID,
    body: ConversationUpdate,
    user: CurrentUser,
    tenant: TenantCtx,
) -> ConversationOut:
    """Rename a conversation."""
    supabase = get_supabase_service_client()
    result = (
        supabase.table("conversations")
        .update({"title": body.title, "updated_at": "NOW()"})
        .eq("id", str(conversation_id))
        .eq("user_id", str(user.user_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv = result.data[0]
    return ConversationOut(**conv, message_count=0)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> None:
    """Soft delete a conversation (set deleted_at timestamp)."""
    supabase = get_supabase_service_client()

    # Day 4: Soft delete instead of hard delete
    result = (
        supabase.table("conversations")
        .update({"deleted_at": "NOW()"})
        .eq("id", str(conversation_id))
        .eq("user_id", str(user.user_id))
        .is_("deleted_at", "null")  # Only delete if not already deleted
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found or already deleted")
