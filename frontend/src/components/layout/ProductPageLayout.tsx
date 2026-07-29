import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import ProductPageHeader from "@/components/layout/ProductPageHeader";

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  maxWidth?: "3xl" | "5xl" | "7xl" | "full";
};

const MAX_W = {
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export default function ProductPageLayout({
  children,
  title,
  description,
  actions,
  className,
  maxWidth = "7xl",
}: Props) {
  return (
    <div className={cn("relative z-10 p-5 sm:p-6 lg:p-8", MAX_W[maxWidth], "mx-auto w-full", className)}>
      {(title || description || actions) && (
        <ProductPageHeader title={title} description={description} actions={actions} />
      )}
      {children}
    </div>
  );
}
