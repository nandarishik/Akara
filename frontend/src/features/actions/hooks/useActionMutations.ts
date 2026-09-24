import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/shared/ui/toast";

import { acceptAction, mutationErrorMessage, rejectAction, snoozeAction } from "../api/actionsApi";
import type { ActionsListResponse, RecommendationResponse } from "../types";

function restoreAndToast(err: unknown) {
  const { message } = mutationErrorMessage(err);
  toast.error(message);
}

export function useActionMutations() {
  const queryClient = useQueryClient();

  function snapshot() {
    const previous = queryClient.getQueriesData<ActionsListResponse>({
      queryKey: ["actions", "queue"],
    });
    return previous;
  }

  function optimisticRemove(id: string) {
    queryClient.setQueriesData<ActionsListResponse>({ queryKey: ["actions", "queue"] }, (old) => {
      if (!old) return old;
      return {
        items: old.items.filter((r) => r.id !== id),
        open_count: Math.max(0, old.open_count - 1),
      };
    });
  }

  function restore(previous: [readonly unknown[], ActionsListResponse | undefined][]) {
    for (const [key, data] of previous) {
      queryClient.setQueryData(key, data);
    }
  }

  const accept = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string | null }) => acceptAction(id, notes),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["actions"] });
      const previous = snapshot();
      optimisticRemove(id);
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) restore(ctx.previous);
      restoreAndToast(err);
    },
    onSuccess: () => {
      toast.success("Tracking started — Akara will measure impact in 14 days.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["actions"] });
    },
  });

  const snooze = useMutation({
    mutationFn: ({
      id,
      days,
      reason,
    }: {
      id: string;
      days: number;
      reason: string | null;
    }) => snoozeAction(id, days, reason),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["actions"] });
      const previous = snapshot();
      optimisticRemove(id);
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) restore(ctx.previous);
      restoreAndToast(err);
    },
    onSuccess: () => {
      toast.success("Snoozed. It will return to the queue when the date arrives.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["actions"] });
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectAction(id, reason),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["actions"] });
      const previous = snapshot();
      optimisticRemove(id);
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) restore(ctx.previous);
      restoreAndToast(err);
    },
    onSuccess: () => {
      toast.success("Rejected — your reason helps the next draft.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["actions"] });
    },
  });

  return { accept, snooze, reject };
}

export type MutationRec = RecommendationResponse;
