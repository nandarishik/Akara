import * as React from "react";

import { ReasonCapture } from "@/features/superadmin/components/ReasonCapture";
import { IrreversibleCheckbox } from "@/features/superadmin/components/IrreversibleCheckbox";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

export interface DangerousActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary: string;
  minReasonLength?: number;
  irreversible?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function DangerousActionDialog({
  open,
  onOpenChange,
  title,
  summary,
  minReasonLength = 10,
  irreversible = false,
  loading = false,
  onConfirm,
}: DangerousActionDialogProps) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [reason, setReason] = React.useState("");
  const [acked, setAcked] = React.useState(false);

  function reset() {
    setStep(1);
    setReason("");
    setAcked(false);
  }

  React.useEffect(() => {
    if (!open) reset();
  }, [open]);

  const reasonOk = reason.trim().length >= minReasonLength;
  const canConfirm = reasonOk && (!irreversible || acked) && !loading;

  async function handleConfirm() {
    if (!canConfirm) return;
    await onConfirm(reason.trim());
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="border-sa-border bg-sa-surface text-sa-text sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sa-text">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sa-muted">{summary}</AlertDialogDescription>
        </AlertDialogHeader>

        {step === 2 && (
          <div className="space-y-4">
            <ReasonCapture
              value={reason}
              onChange={setReason}
              minLength={minReasonLength}
              disabled={loading}
            />
            {irreversible && (
              <IrreversibleCheckbox
                checked={acked}
                onCheckedChange={setAcked}
                disabled={loading}
              />
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            className="border-sa-border bg-sa-raised text-sa-text hover:bg-sa-border"
            onClick={() => reset()}
          >
            Cancel
          </AlertDialogCancel>
          {step === 1 ? (
            <Button
              variant="primary"
              onClick={(e) => {
                e.preventDefault();
                setStep(2);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="destructive"
              loading={loading}
              disabled={!canConfirm}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              Confirm
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
