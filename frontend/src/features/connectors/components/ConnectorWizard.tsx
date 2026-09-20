import { useState } from "react";
import { Link } from "react-router-dom";

import {
  createConnector,
  testConnector,
} from "../api/connectorsApi";
import { customerErrorMessage } from "../api/errorMessages";
import type { ConnectorType } from "../api/types";
import { CredentialFields } from "./CredentialFields";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { SecondaryButton } from "@/shared/ui/GradientButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

const TYPES: { type: ConnectorType; label: string; gated?: boolean }[] = [
  { type: "petpooja", label: "Petpooja" },
  { type: "tally", label: "Tally (akara-connect)" },
  { type: "google_sheets", label: "Google Sheets" },
  { type: "urban_piper", label: "UrbanPiper", gated: true },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** When reconnecting, preselect type/name but credentials stay blank. */
  reconnect?: { connectorType: ConnectorType; sourceName: string } | null;
  onCreated?: (id: string) => void;
};

export function ConnectorWizard({ open, onClose, reconnect, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [connectorType, setConnectorType] = useState<ConnectorType>(
    reconnect?.connectorType ?? "petpooja",
  );
  const [sourceName, setSourceName] = useState(reconnect?.sourceName ?? "");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [tallyKey, setTallyKey] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  if (!open) return null;

  const selectedMeta = TYPES.find((t) => t.type === connectorType);

  async function goCreate() {
    if (selectedMeta?.gated) {
      toast.error(customerErrorMessage("GATED", sourceName || "UrbanPiper"));
      return;
    }
    setBusy(true);
    try {
      const body = {
        connector_type: connectorType,
        source_name: sourceName.trim() || selectedMeta?.label || "Connector",
        credentials: connectorType === "tally" ? undefined : credentials,
        config: {},
      };
      const created = await createConnector(body);
      setCreatedId(created.id);
      if (created.connector_api_key) setTallyKey(created.connector_api_key);
      setStep(3);
      onCreated?.(created.id);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function goTest() {
    if (!createdId) return;
    setBusy(true);
    setTestMessage(null);
    try {
      const result = await testConnector(createdId);
      setTestMessage(result.message);
      if (connectorType === "urban_piper" || result.details?.gated) {
        toast.error(customerErrorMessage("GATED", sourceName || "UrbanPiper"));
        return;
      }
      if (
        (connectorType === "petpooja" || connectorType === "google_sheets") &&
        !result.connected
      ) {
        toast.error(result.message || customerErrorMessage("INVALID_CREDENTIALS", sourceName));
        return;
      }
      // Tally may proceed without online agent
      setStep(4);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function resetAndClose() {
    setStep(1);
    setCredentials({});
    setCreatedId(null);
    setTallyKey(null);
    setTestMessage(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Connector wizard"
      data-testid="connector-wizard"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-elevated p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {reconnect ? "Reconnect source" : "Connect a live source"}
          </h2>
          <button
            type="button"
            className="text-sm text-text-muted hover:text-text-primary"
            onClick={resetAndClose}
          >
            Close
          </button>
        </div>

        <p className="mb-4 text-xs text-text-muted">Step {step} of 4</p>

        {step === 1 && (
          <div className="flex flex-col gap-2" data-testid="wizard-step-1">
            {TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                disabled={t.gated}
                className={`rounded-md border px-3 py-2 text-left text-sm ${
                  connectorType === t.type
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-border-subtle text-text-primary"
                } ${t.gated ? "cursor-not-allowed opacity-50" : ""}`}
                onClick={() => setConnectorType(t.type)}
              >
                {t.label}
                {t.gated ? " (coming soon)" : ""}
              </button>
            ))}
            <div className="mt-3 flex justify-end gap-2">
              <SecondaryButton type="button" onClick={resetAndClose}>
                Cancel
              </SecondaryButton>
              <GlowCTAButton type="button" onClick={() => setStep(2)} disabled={!!selectedMeta?.gated}>
                Next
              </GlowCTAButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3" data-testid="wizard-step-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-muted">Display name</span>
              <input
                className="rounded-md border border-border-subtle bg-surface-canvas px-3 py-2 text-text-primary"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Brewlab POS"
              />
            </label>
            <CredentialFields
              connectorType={connectorType}
              values={credentials}
              onChange={setCredentials}
              disabled={busy}
            />
            <p className="text-xs text-text-muted">
              Secrets are masked and never shown again after save. Reconnect always starts blank.
            </p>
            <div className="mt-2 flex justify-between gap-2">
              <SecondaryButton type="button" onClick={() => setStep(1)}>
                Back
              </SecondaryButton>
              <GlowCTAButton type="button" onClick={() => void goCreate()} disabled={busy}>
                {busy ? "Saving…" : "Save & continue"}
              </GlowCTAButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3" data-testid="wizard-step-3">
            {tallyKey ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium text-text-primary">Copy your connector API key now</p>
                <code className="mt-2 block break-all font-mono text-xs">{tallyKey}</code>
                <p className="mt-2 text-xs text-text-muted">It will not be shown again.</p>
              </div>
            ) : null}
            <p className="text-sm text-text-muted">
              Test the connection before finishing. Tally may continue even if the agent is offline.
            </p>
            {testMessage ? <p className="text-sm text-text-primary">{testMessage}</p> : null}
            <div className="flex justify-end gap-2">
              <GlowCTAButton type="button" onClick={() => void goTest()} disabled={busy || !createdId}>
                {busy ? "Testing…" : "Test connection"}
              </GlowCTAButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3" data-testid="wizard-step-4">
            <p className="text-sm text-text-primary">You&apos;re connected. Syncs will run on schedule.</p>
            <p className="text-sm text-text-muted">
              Prefer CSV? Keep using{" "}
              <Link to="/data" className="text-accent underline">
                Data import
              </Link>
              .
            </p>
            <div className="flex justify-end">
              <GlowCTAButton type="button" onClick={resetAndClose}>
                Done
              </GlowCTAButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
