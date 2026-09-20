import { Label } from "@/shared/ui/label";

export interface IrreversibleCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function IrreversibleCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
  id = "irreversible-ack",
}: IrreversibleCheckboxProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-sa-border bg-sa-raised/50 p-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        required
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-sa-border accent-sa-accent"
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug text-sa-text">
        I understand this cannot be undone
      </Label>
    </div>
  );
}
