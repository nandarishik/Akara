import { MessageSquare, X } from "lucide-react";
import type { Conversation } from "@/features/copilot/hooks/useConversations";
import { cn } from "@/lib/utils";

interface MobileHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  loading: boolean;
  conversationId: string | null;
  onSelect: (id: string) => void;
}

export function MobileHistoryDrawer({
  open,
  onClose,
  conversations,
  loading,
  conversationId,
  onSelect,
}: MobileHistoryDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]",
          "bg-surface-card border-r border-surface-border flex flex-col md:hidden"
        )}
        aria-label="Chat history"
      >
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <MessageSquare className="h-4 w-4 text-accent" />
            Chat history
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
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
                onClick={() => {
                  onSelect(conv.id);
                  onClose();
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]",
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
      </aside>
    </>
  );
}
