import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import { dicebearUrl } from "@/lib/avatar";

const AVATAR_OVERLAP = 12;

const avatarVariants: Variants = {
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22, mass: 0.6 },
  },
  hidden: {
    opacity: 0,
    scale: 0.85,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

export type SeatSlot = {
  id: string;
  label: string;
  seed: string;
  filled: boolean;
};

type TeamSeatVisualizerProps = {
  slots: SeatSlot[];
  occupied: number;
  seatLimit: number;
  className?: string;
};

export default function TeamSeatVisualizer({
  slots,
  occupied,
  seatLimit,
  className,
}: TeamSeatVisualizerProps) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.2)]",
        className
      )}
    >
      <fieldset>
        <legend className="mb-5 w-full text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          Seats in use
        </legend>

        <div className="mb-6 flex justify-center">
          <div className="flex items-center">
            {slots.map((slot, index) => (
              <motion.div
                key={slot.id}
                animate={slot.filled ? "visible" : "hidden"}
                className="flex items-center justify-center"
                initial={slot.filled ? "visible" : "hidden"}
                style={{
                  marginLeft: index === 0 ? 0 : -AVATAR_OVERLAP,
                  zIndex: slots.length - index,
                }}
                variants={avatarVariants}
              >
                {slot.filled ? (
                  <img
                    alt={slot.label}
                    className="size-11 rounded-full border-2 border-[#0a0a0a] bg-[#262626] object-cover shadow-[0_2px_8px_rgba(0,0,0,0.3)] ring-1 ring-white/10"
                    src={dicebearUrl(slot.seed)}
                    title={slot.label}
                  />
                ) : (
                  <div
                    className="size-11 rounded-full border-2 border-dashed border-white/15 bg-white/5"
                    aria-hidden
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.output
            animate={{ opacity: 1, y: 0 }}
            aria-live="polite"
            className="select-none text-3xl font-semibold tabular-nums text-white"
          >
            {occupied}
            <span className="text-lg font-normal text-white/40"> / {seatLimit}</span>
          </motion.output>
          <p className="text-xs text-white/45">includes pending invites</p>
        </div>
      </fieldset>
    </div>
  );
}

export function buildSeatSlots(
  members: { id: string; email: string | null; display_name: string | null; membership_status: string }[],
  invites: { id: string; email_normalized: string }[],
  seatLimit: number
): SeatSlot[] {
  const filled: SeatSlot[] = [];

  for (const m of members.filter((x) => x.membership_status === "active")) {
    filled.push({
      id: m.id,
      label: m.display_name || m.email || "Member",
      seed: m.id,
      filled: true,
    });
  }

  for (const inv of invites) {
    filled.push({
      id: inv.id,
      label: inv.email_normalized,
      seed: inv.email_normalized,
      filled: true,
    });
  }

  const slots: SeatSlot[] = [];
  for (let i = 0; i < seatLimit; i++) {
    const entry = filled[i];
    if (entry) {
      slots.push(entry);
    } else {
      slots.push({
        id: `empty-${i}`,
        label: "Empty seat",
        seed: `empty-${i}`,
        filled: false,
      });
    }
  }

  return slots;
}
