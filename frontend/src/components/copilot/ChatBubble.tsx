import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useCopilot";

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex gap-3 max-w-3xl",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold",
          isUser
            ? "bg-slate-900 text-white"
            : "bg-indigo-100 text-indigo-700"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm max-w-lg",
          isUser
            ? "bg-slate-900 text-white rounded-tr-sm"
            : message.error
            ? "bg-red-50 text-red-700 border border-red-200 rounded-tl-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.streaming && (
          <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}
