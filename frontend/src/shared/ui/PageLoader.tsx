import Loader from "@/shared/ui/Loader";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  minHeight?: string;
};

export default function PageLoader({
  title = "Loading AKARAâ€¦",
  subtitle,
  size = "md",
  className,
  minHeight = "min-h-[200px]",
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "theme-product-dark flex w-full items-center justify-center bg-[#0a0a0a]",
        minHeight,
        className
      )}
      aria-busy="true"
    >
      <Loader title={title} subtitle={subtitle} size={size} />
    </div>
  );
}
