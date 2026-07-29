import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export default function ProductPageHeader({ title, description, actions, className }: Props) {
  if (!title && !description && !actions) return null;

  return (
    <header className={cn("mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4", className)}>
      <div>
        {title && (
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">{title}</h1>
        )}
        {description && <p className="mt-1.5 text-sm sm:text-base text-white/60 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
