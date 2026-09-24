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

import { REJECT_REASONS } from "../types";

export type RejectModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function RejectModal({ open, onClose, onConfirm }: RejectModalProps) {
  const [reason, setReason] = useState<(typeof REJECT_REASONS)[number] | "">("");
  const [other, setOther] = useState("");

  const otherOk = other.trim().length >= 3;
  const canConfirm = reason !== "" && (reason !== "Other" || otherOk);
  const payload = reason === "Other" ? `Other: ${other.trim()}` : reason;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject recommendation</AlertDialogTitle>
          <AlertDialogDescription>
            A reason is required. It is stored so later drafts can learn from it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Reason</legend>
          {REJECT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reject-reason"
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {r}
            </label>
          ))}
        </fieldset>
        {reason === "Other" ? (
          <label className="block text-sm text-text-secondary">
            Tell us more (at least 3 characters)
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm text-text-primary"
              value={other}
              onChange={(e) => setOther(e.target.value)}
            />
          </label>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              onConfirm(payload);
              setReason("");
              setOther("");
            }}
          >
            Reject
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
