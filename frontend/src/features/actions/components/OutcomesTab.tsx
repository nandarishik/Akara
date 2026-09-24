import { useActionOutcomes } from "../hooks/useActions";
import { OutcomeCard } from "./OutcomeCard";

export function OutcomesTab() {
  const { data, isLoading, error } = useActionOutcomes();
  const items = data?.items ?? [];

  if (isLoading) return <p className="text-sm text-text-muted">Loading outcomes…</p>;
  if (error) return <p className="text-sm text-amber-300">Could not load outcomes.</p>;
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">No measured outcomes yet. Accept a recommendation to start the 14-day clock.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((rec) => (
        <li key={rec.id}>
          <OutcomeCard rec={rec} />
        </li>
      ))}
    </ul>
  );
}
