import { cn } from "@/lib/utils";
import { AVATAR_PRESETS, dicebearUrl, type AvatarSeed } from "@/lib/avatar";

type AvatarPickerProps = {
  value: string;
  onChange: (seed: AvatarSeed) => void;
  className?: string;
};

export default function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm font-medium text-white/90">Choose your avatar</p>
      <div className="flex flex-wrap gap-3">
        {AVATAR_PRESETS.map((seed) => {
          const selected = value === seed;
          return (
            <button
              key={seed}
              type="button"
              onClick={() => onChange(seed)}
              className={cn(
                "relative rounded-full p-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#03B3C3]/50",
                selected
                  ? "bg-gradient-to-br from-[#D856BF] via-[#03B3C3] to-[#38bdf8] scale-105"
                  : "bg-white/10 hover:bg-white/20"
              )}
              aria-label={`Select avatar ${seed}`}
              aria-pressed={selected}
            >
              <img
                src={dicebearUrl(seed)}
                alt=""
                className="size-11 rounded-full bg-[#111] object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
