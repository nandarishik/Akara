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

import { ACCEPT_MODAL_COPY, type RecommendationResponse } from "../types";

export type AcceptModalProps = {
  open: boolean;
  rec: RecommendationResponse;
  onClose: () => void;
  onConfirm: (notes: string | null) => void;
};

export function AcceptModal({ open, rec, onClose, onConfirm }: AcceptModalProps) {
  const [notes, setNotes] = useState("");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Accept this recommendation?</AlertDialogTitle>
          <AlertDialogDescription>{ACCEPT_MODAL_COPY}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm font-medium text-text-primary">{rec.title}</p>
        <label className="block text-sm text-text-secondary">
          Notes (optional)
          <textarea
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm text-text-primary"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm(notes.trim() || null);
              setNotes("");
            }}
          >
            Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
