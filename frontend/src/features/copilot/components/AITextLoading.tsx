import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
  compact?: boolean;
}

const DEFAULT_TEXTS = [
  "Thinking…",
  "Analyzing your data…",
  "Crunching numbers…",
  "Almost there…",
];

export default function AITextLoading({
  texts = DEFAULT_TEXTS,
  className,
  interval = 1500,
  compact = false,
}: AITextLoadingProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prev) => (prev + 1) % texts.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval, texts.length]);

  return (
    <div className={cn("flex items-center", compact ? "p-0" : "justify-center p-8", className)}>
      <motion.div
        animate={{ opacity: 1 }}
        className="relative w-full"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            animate={{
              opacity: 1,
              y: 0,
              backgroundPosition: ["200% center", "-200% center"],
            }}
            className={cn(
              "inline-block bg-[length:200%_100%] bg-gradient-to-r from-[#0a0a0a] via-[#03B3C3] to-[#0a0a0a] bg-clip-text font-medium text-transparent",
              compact ? "text-sm" : "text-base sm:text-lg"
            )}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key={currentTextIndex}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 0.3 },
              backgroundPosition: {
                duration: 2.5,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              },
            }}
          >
            {texts[currentTextIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
