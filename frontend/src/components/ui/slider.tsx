/**
 * Slider — shadcn/ui-compatible range slider using native <input type="range">.
 *
 * API matches shadcn Slider:
 *   value={[number]}
 *   min, max, step
 *   onValueChange={([value]) => ...}
 *   disabled
 *   className
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      value,
      defaultValue,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const controlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState<number>(
      (controlled ? value![0] : defaultValue?.[0]) ?? min
    );

    const currentValue = controlled ? value![0] : internalValue;

    // Percentage for the fill track
    const pct = ((currentValue - min) / (max - min)) * 100;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const next = Number(e.target.value);
      if (!controlled) setInternalValue(next);
      onValueChange?.([next]);
    }

    return (
      <div
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        {...props}
      >
        {/* Track background */}
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
          {/* Filled portion */}
          <div
            className="absolute h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Native range input overlaid — invisible but interactive */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          disabled={disabled}
          onChange={handleChange}
          className={cn(
            "absolute inset-0 h-full w-full cursor-pointer opacity-0",
            disabled && "cursor-not-allowed"
          )}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
        />
        {/* Thumb */}
        <div
          className={cn(
            "absolute h-5 w-5 rounded-full border-2 border-indigo-600 bg-white shadow-sm",
            "ring-offset-white transition-all focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2",
            disabled && "cursor-not-allowed opacity-50",
            "-translate-x-1/2 pointer-events-none"
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
