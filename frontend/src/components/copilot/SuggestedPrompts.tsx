const SUGGESTIONS = [
  "What were my top 5 selling products last month?",
  "Which zone had the highest revenue this quarter?",
  "Show me the revenue trend for the past 30 days",
  "Which parties haven't ordered in the past 2 weeks?",
  "Compare revenue this month vs last month",
];

interface Props {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 text-center">Try asking:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
