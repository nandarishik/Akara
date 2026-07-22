import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-100 p-5 bg-white",
        className
      )}
    >
      <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse mb-4" />
      {[...Array(lines)].map((_, i) => (
        <div
          key={i}
          className="h-3 bg-slate-100 rounded animate-pulse mb-2 last:mb-0"
          style={{ width: `${90 - i * 10}%` }}
        />
      ))}
    </div>
  );
}
