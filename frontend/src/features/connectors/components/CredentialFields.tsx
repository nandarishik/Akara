import type { ConnectorType } from "../api/types";

type Props = {
  connectorType: ConnectorType;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
};

const FIELDS: Record<
  ConnectorType,
  { key: string; label: string; masked?: boolean; multiline?: boolean }[]
> = {
  petpooja: [
    { key: "api_key", label: "API key", masked: true },
    { key: "restaurant_id", label: "Restaurant ID" },
  ],
  google_sheets: [
    { key: "spreadsheet_id", label: "Spreadsheet ID" },
    {
      key: "gcp_service_account_json",
      label: "Service account JSON",
      masked: true,
      multiline: true,
    },
  ],
  urban_piper: [
    { key: "api_key", label: "API key", masked: true },
    { key: "merchant_id", label: "Merchant ID" },
  ],
  tally: [],
};

export function CredentialFields({ connectorType, values, onChange, disabled }: Props) {
  const fields = FIELDS[connectorType];
  if (connectorType === "tally") {
    return (
      <p className="text-sm text-text-muted">
        Tally uses a one-time API key generated after you create the connector. No POS secrets are
        entered here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="credential-fields">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">{f.label}</span>
          {f.multiline ? (
            <textarea
              className="min-h-[6rem] rounded-md border border-border-subtle bg-surface-canvas px-3 py-2 font-mono text-xs text-text-primary"
              value={values[f.key] ?? ""}
              disabled={disabled}
              autoComplete="off"
              onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
            />
          ) : (
            <input
              type={f.masked ? "password" : "text"}
              className="rounded-md border border-border-subtle bg-surface-canvas px-3 py-2 text-text-primary"
              value={values[f.key] ?? ""}
              disabled={disabled}
              autoComplete="off"
              onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );
}
