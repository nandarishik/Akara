import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { deleteConnector, listConnectors } from "../api/connectorsApi";
import type { ConnectorSummary, ConnectorType } from "../api/types";
import { ConnectorStatusCard } from "../components/ConnectorStatusCard";
import { ConnectorWizard } from "../components/ConnectorWizard";
import { ReconnectPanel } from "../components/ReconnectPanel";
import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

export function ConnectorListPage() {
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reconnect, setReconnect] = useState<{
    type: ConnectorType;
    name: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConnectors();
      setConnectors(res.connectors);
    } catch (e) {
      toast.error(formatApiError(e));
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onDisconnect(id: string) {
    try {
      await deleteConnector(id);
      toast.success("Connector disconnected");
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }

  function onReconnect(id: string) {
    const c = connectors.find((x) => x.id === id);
    if (!c) return;
    setReconnect({ type: c.connector_type, name: c.source_name });
  }

  return (
    <ProductPageLayout
      title="Connectors"
      description="Live POS and ledger sync. CSV upload on Data remains available as a fallback."
      actions={
        <GlowCTAButton type="button" onClick={() => setWizardOpen(true)}>
          Add connector
        </GlowCTAButton>
      }
    >
      {loading ? (
        <p className="text-sm text-text-muted">Loading connectors…</p>
      ) : connectors.length === 0 ? (
        <div className="py-10" data-testid="connectors-empty">
          <p className="text-text-primary">No live connectors yet.</p>
          <p className="mt-2 text-sm text-text-muted">
            Connect Petpooja, Tally, or Google Sheets — or keep uploading CSV on{" "}
            <Link to="/data" className="text-accent underline">
              Data
            </Link>
            .
          </p>
        </div>
      ) : (
        <div>
          {connectors.map((c) => (
            <ConnectorStatusCard
              key={c.id}
              connector={c}
              onReconnect={onReconnect}
              onDisconnect={(id) => void onDisconnect(id)}
            />
          ))}
        </div>
      )}

      <ConnectorWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          void refresh();
        }}
        onCreated={() => void refresh()}
      />

      <ReconnectPanel
        open={!!reconnect}
        connectorType={reconnect?.type ?? "petpooja"}
        sourceName={reconnect?.name ?? ""}
        onClose={() => {
          setReconnect(null);
          void refresh();
        }}
        onCreated={() => void refresh()}
      />
    </ProductPageLayout>
  );
}
