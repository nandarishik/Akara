import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

export interface ReasonCaptureProps {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  disabled?: boolean;
  id?: string;
}

export function ReasonCapture({
  value,
  onChange,
  minLength = 10,
  disabled = false,
  id = "dangerous-reason",
}: ReasonCaptureProps) {
  const trimmed = value.trim().length;
  const ok = trimmed >= minLength;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sa-text">
        Reason
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        minLength={minLength}
        placeholder={`Explain why (min ${minLength} characters)`}
        className="min-h-[88px] border-sa-border bg-sa-bg text-sa-text placeholder:text-sa-muted focus-visible:ring-sa-accent/30"
      />
      {!ok && value.length > 0 && (
        <p className="text-xs text-amber-400">
          {minLength - trimmed} more character{minLength - trimmed === 1 ? "" : "s"} needed
        </p>
      )}
    </div>
  );
}
