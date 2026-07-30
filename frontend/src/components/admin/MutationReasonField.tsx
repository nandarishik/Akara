import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface MutationReasonFieldProps {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}

export function MutationReasonField({
  value,
  onChange,
  minLength = 10,
}: MutationReasonFieldProps) {
  const ok = value.trim().length >= minLength;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-sa-muted">Reason (required, min {minLength} chars)</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Why are you making this change?"
        className="bg-sa-raised border-sa-border text-sm"
      />
      {!ok && value.length > 0 && (
        <p className="text-xs text-amber-400">{minLength - value.trim().length} more characters needed</p>
      )}
    </div>
  );
}
