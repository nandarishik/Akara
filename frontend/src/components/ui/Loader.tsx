import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizeConfig = {
  sm: {
    container: "size-20",
    titleClass: "text-sm/tight font-medium",
    subtitleClass: "text-xs/relaxed",
    spacing: "space-y-2",
    maxWidth: "max-w-48",
  },
  md: {
    container: "size-32",
    titleClass: "text-base/snug font-medium",
    subtitleClass: "text-sm/relaxed",
    spacing: "space-y-3",
    maxWidth: "max-w-56",
  },
  lg: {
    container: "size-40",
    titleClass: "text-lg/tight font-semibold",
    subtitleClass: "text-base/relaxed",
    spacing: "space-y-4",
    maxWidth: "max-w-64",
  },
} as const;

function Ring({
  rotate,
  duration,
  ease,
  background,
  mask,
  opacity,
}: {
  rotate: number[];
  duration: number;
  ease: "linear" | [number, number, number, number];
  background: string;
  mask: string;
  opacity: number;
}) {
  return (
    <motion.div
      animate={{ rotate }}
      className="absolute inset-0 rounded-full"
      style={{
        background,
        mask,
        WebkitMask: mask,
        opacity,
      }}
      transition={{
        duration,
        repeat: Number.POSITIVE_INFINITY,
        ease,
      }}
    />
  );
}

export default function Loader({
  title = "Configuring your account…",
  subtitle = "Please wait while we prepare everything for you",
  size = "md",
  showText = true,
  className,
  ...props
}: LoaderProps) {
  const config = sizeConfig[size];

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-8 p-8", className)}
      {...props}
    >
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        className={cn("relative", config.container)}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: [0.4, 0, 0.6, 1],
        }}
      >
        <Ring
          rotate={[0, 360]}
          duration={3}
          ease="linear"
          opacity={0.8}
          background="conic-gradient(from 0deg, transparent 0deg, rgb(255, 255, 255) 90deg, transparent 180deg)"
          mask="radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)"
        />
        <Ring
          rotate={[0, 360]}
          duration={2.5}
          ease={[0.4, 0, 0.6, 1]}
          opacity={0.9}
          background="conic-gradient(from 0deg, transparent 0deg, rgb(255, 255, 255) 120deg, rgba(3, 179, 195, 0.6) 240deg, transparent 360deg)"
          mask="radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)"
        />
        <Ring
          rotate={[0, -360]}
          duration={4}
          ease={[0.4, 0, 0.6, 1]}
          opacity={0.35}
          background="conic-gradient(from 180deg, transparent 0deg, rgba(255, 255, 255, 0.6) 45deg, transparent 90deg)"
          mask="radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)"
        />
        <Ring
          rotate={[0, 360]}
          duration={3.5}
          ease="linear"
          opacity={0.5}
          background="conic-gradient(from 270deg, transparent 0deg, rgba(3, 179, 195, 0.5) 20deg, transparent 40deg)"
          mask="radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-2 rounded-full bg-white/30" />
        </div>
      </motion.div>

      {showText && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={cn("text-center", config.spacing, config.maxWidth)}
          initial={{ opacity: 0, y: 12 }}
          transition={{ delay: 0.4, duration: 1, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.h1
            className={cn(config.titleClass, "font-medium text-white/90 leading-[1.15] tracking-[-0.02em]")}
          >
            <motion.span
              animate={{ opacity: [0.9, 0.7, 0.9] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
            >
              {title}
            </motion.span>
          </motion.h1>
          {subtitle && (
            <motion.p
              className={cn(config.subtitleClass, "font-normal text-white/50 leading-[1.45]")}
            >
              <motion.span
                animate={{ opacity: [0.6, 0.4, 0.6] }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
              >
                {subtitle}
              </motion.span>
            </motion.p>
          )}
        </motion.div>
      )}
    </div>
  );
}
