import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationItem } from "./ConversationItem";
import type { Conversation } from "@/hooks/useConversations";

interface Props {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
}: Props) {
  return (
    <div className="w-80 h-full border-r border-slate-200 bg-slate-50 flex flex-col">
      {/* Header with New Chat button */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <Button
          onClick={onNewChat}
          className="w-full"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {conversations.length === 0 ? (
          <div className="text-center text-sm text-slate-400 mt-8">
            No conversations yet
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              onSelect={() => onSelectConversation(conv.id)}
              onRename={(title) => onRenameConversation(conv.id, title)}
              onDelete={() => onDeleteConversation(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
