import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/features/copilot/hooks/useConversations";

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [showDelete, setShowDelete] = useState(false);

  function handleSave() {
    if (editTitle.trim()) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditTitle(conversation.title);
    setIsEditing(false);
  }

  function handleDelete() {
    if (showDelete) {
      onDelete();
    } else {
      setShowDelete(true);
      setTimeout(() => setShowDelete(false), 3000);
    }
  }

  if (isEditing) {
    return (
      <div className="px-3 py-2 bg-white border border-slate-300 rounded-lg">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="w-full text-sm px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoFocus
        />
        <div className="flex gap-1 mt-1">
          <button
            onClick={handleSave}
            className="p-1 hover:bg-slate-100 rounded"
            title="Save"
          >
            <Check className="h-3 w-3 text-green-600" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-slate-100 rounded"
            title="Cancel"
          >
            <X className="h-3 w-3 text-slate-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative px-3 py-2 rounded-lg cursor-pointer transition-colors",
        isActive
          ? "bg-indigo-50 border border-indigo-200"
          : "hover:bg-slate-50 border border-transparent"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-sm truncate flex-1",
            isActive ? "text-indigo-900 font-medium" : "text-slate-700"
          )}
        >
          {conversation.title}
        </p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1 hover:bg-white rounded"
            title="Rename"
          >
            <Pencil className="h-3 w-3 text-slate-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className={cn(
              "p-1 hover:bg-white rounded",
              showDelete && "bg-red-50"
            )}
            title={showDelete ? "Click again to confirm" : "Delete"}
          >
            <Trash2
              className={cn(
                "h-3 w-3",
                showDelete ? "text-red-600" : "text-slate-500"
              )}
            />
          </button>
        </div>
      </div>
      {conversation.message_count > 0 && (
        <p className="text-xs text-slate-400 mt-0.5">
          {conversation.message_count} messages
        </p>
      )}
    </div>
  );
}
