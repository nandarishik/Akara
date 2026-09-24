import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

export type SnoozeModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (days: number, reason: string | null) => void;
};

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  return Math.max(1, diff);
}

export function SnoozeModal({ open, onClose, onConfirm }: SnoozeModalProps) {
  const [preset, setPreset] = useState<7 | 14 | 30 | "custom">(7);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");

  function resolveDays(): number {
    if (preset === "custom") return custom ? daysUntil(custom) : 7;
    return preset;
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Snooze recommendation</AlertDialogTitle>
          <AlertDialogDescription>
            Hide this card until the snooze date. It will return to the open queue automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Duration</legend>
          {[7, 14, 30].map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="snooze-days"
                checked={preset === d}
                onChange={() => setPreset(d as 7 | 14 | 30)}
              />
              {d} days
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="snooze-days"
              checked={preset === "custom"}
              onChange={() => setPreset("custom")}
            />
            Custom date
          </label>
          {preset === "custom" ? (
            <input
              type="date"
              className="w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          ) : null}
        </fieldset>
        <label className="block text-sm text-text-secondary">
          Reason (optional)
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm text-text-primary"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm(resolveDays(), reason.trim() || null);
              setReason("");
            }}
          >
            Snooze
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
