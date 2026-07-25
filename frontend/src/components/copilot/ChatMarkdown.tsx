import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-3 -mx-1">
      <table {...props} className="min-w-full border-collapse">
        {children}
      </table>
    </div>
  ),
};

export function ChatMarkdown({ content, className }: Props) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        "prose-headings:font-semibold prose-headings:text-text-primary",
        "prose-p:my-2 prose-p:leading-relaxed prose-p:text-text-primary",
        "prose-strong:text-text-primary prose-strong:font-semibold",
        "prose-table:text-sm prose-table:my-0",
        "prose-th:bg-surface-raised prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-surface-border",
        "prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-surface-border",
        "prose-ul:my-2 prose-li:my-0.5 prose-li:text-text-primary",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
