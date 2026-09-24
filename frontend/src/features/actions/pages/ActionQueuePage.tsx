import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import { Button } from "@/shared/ui/button";

import { AcceptModal } from "../components/AcceptModal";
import { ActionHistoryTab } from "../components/ActionHistoryTab";
import { ActionQueueHeader } from "../components/ActionQueueHeader";
import { OutcomesTab } from "../components/OutcomesTab";
import { RecommendationCard } from "../components/RecommendationCard";
import { RejectModal } from "../components/RejectModal";
import { SnoozeModal } from "../components/SnoozeModal";
import { useActionMutations } from "../hooks/useActionMutations";
import { useActions } from "../hooks/useActions";
import {
  EMPTY_QUEUE_COPY,
  type ActionsTab,
  type RecommendationResponse,
  type SortKey,
  type TypeFilter,
} from "../types";

const TABS: { id: ActionsTab; label: string }[] = [
  { id: "queue", label: "Queue" },
  { id: "history", label: "History" },
  { id: "outcomes", label: "Outcomes" },
];

function parseTab(raw: string | null): ActionsTab {
  if (raw === "history" || raw === "outcomes" || raw === "queue") return raw;
  return "queue";
}

function parseSort(raw: string | null): SortKey {
  if (raw === "impact" || raw === "date" || raw === "confidence") return raw;
  return "confidence";
}

function parseType(raw: string | null): TypeFilter {
  const allowed: TypeFilter[] = [
    "all",
    "menu_engineering",
    "pricing",
    "waste",
    "operational",
    "gst",
    "delivery_margin",
    "promotion",
  ];
  return allowed.includes(raw as TypeFilter) ? (raw as TypeFilter) : "all";
}

export function ActionQueuePage() {
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"));
  const sort = parseSort(params.get("sort"));
  const type = parseType(params.get("type"));

  const { data, isLoading, error } = useActions(sort, type);
  const mutations = useActionMutations();
  const items = data?.items ?? [];
  const openCount = data?.open_count ?? items.length;

  const [active, setActive] = useState<RecommendationResponse | null>(null);
  const [modal, setModal] = useState<"accept" | "snooze" | "reject" | null>(null);

  function setQuery(next: Record<string, string>) {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === "queue" || v === "all" || (k === "sort" && v === "confidence")) {
        if (k === "tab" && v === "queue") merged.delete("tab");
        else if (k === "type" && v === "all") merged.delete("type");
        else if (k === "sort" && v === "confidence") merged.delete("sort");
        else merged.set(k, v);
      } else {
        merged.set(k, v);
      }
    }
    setParams(merged, { replace: true });
  }

  const queue = useMemo(() => items, [items]);

  return (
    <ProductPageLayout
      title="Actions"
      description="Drafted recommendations — nothing runs until you accept."
    >
      <div className="mb-5 flex gap-2" role="tablist" aria-label="Actions views">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "primary" : "ghost"}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setQuery({ tab: t.id })}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "queue" ? (
        <>
          <ActionQueueHeader
            openCount={openCount}
            sort={sort}
            type={type}
            onSort={(s) => setQuery({ sort: s })}
            onType={(t) => setQuery({ type: t })}
          />
          {isLoading ? (
            <p className="text-sm text-text-muted">Loading recommendations…</p>
          ) : error ? (
            <p className="text-sm text-amber-300">Could not load recommendations.</p>
          ) : queue.length === 0 ? (
            <p className="text-sm text-text-secondary">{EMPTY_QUEUE_COPY}</p>
          ) : (
            <ul className="space-y-4">
              {queue.map((rec) => (
                <li key={rec.id}>
                  <RecommendationCard
                    rec={rec}
                    onAccept={() => {
                      setActive(rec);
                      setModal("accept");
                    }}
                    onSnooze={() => {
                      setActive(rec);
                      setModal("snooze");
                    }}
                    onReject={() => {
                      setActive(rec);
                      setModal("reject");
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {tab === "history" ? <ActionHistoryTab /> : null}
      {tab === "outcomes" ? <OutcomesTab /> : null}

      {active ? (
        <AcceptModal
          open={modal === "accept"}
          rec={active}
          onClose={() => setModal(null)}
          onConfirm={(notes) => {
            mutations.accept.mutate({ id: active.id, notes });
            setModal(null);
          }}
        />
      ) : null}
      <SnoozeModal
        open={modal === "snooze"}
        onClose={() => setModal(null)}
        onConfirm={(days, reason) => {
          if (active) mutations.snooze.mutate({ id: active.id, days, reason });
          setModal(null);
        }}
      />
      <RejectModal
        open={modal === "reject"}
        onClose={() => setModal(null)}
        onConfirm={(reason) => {
          if (active) mutations.reject.mutate({ id: active.id, reason });
          setModal(null);
        }}
      />
    </ProductPageLayout>
  );
}
