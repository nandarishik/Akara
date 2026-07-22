import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
}

export function ChatMarkdown({ content, className }: Props) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-slate max-w-none",
        "prose-headings:font-semibold prose-headings:text-slate-900",
        "prose-p:my-2 prose-p:leading-relaxed prose-p:text-slate-800",
        "prose-strong:text-slate-900 prose-strong:font-semibold",
        "prose-table:text-sm prose-table:my-3",
        "prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold",
        "prose-td:px-3 prose-td:py-2 prose-td:border-slate-200",
        "prose-ul:my-2 prose-li:my-0.5",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
