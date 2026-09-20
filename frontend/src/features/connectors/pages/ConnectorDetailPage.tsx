import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getConnector, getConnectorLogs, syncConnector } from "../api/connectorsApi";
import type { ConnectorDetail, SyncLogRow } from "../api/types";
import { SyncHealthChart } from "../components/SyncHealthChart";
import { SyncLogsTable } from "../components/SyncLogsTable";
import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { SecondaryButton } from "@/shared/ui/GradientButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

export function ConnectorDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<ConnectorDetail | null>(null);
  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, l] = await Promise.all([getConnector(id), getConnectorLogs(id)]);
      setDetail(d);
      setLogs(l.logs.length ? l.logs : d.logs ?? []);
    } catch (e) {
      toast.error(formatApiError(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSyncNow() {
    if (!id) return;
    try {
      await syncConnector(id);
      toast.success("Sync accepted");
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }

  if (loading) {
    return (
      <ProductPageLayout title="Connector">
        <p className="text-sm text-text-muted">Loading…</p>
      </ProductPageLayout>
    );
  }

  if (!detail) {
    return (
      <ProductPageLayout title="Connector">
        <p className="text-sm text-text-muted">Connector not found.</p>
        <Link to="/connectors" className="mt-2 inline-block text-accent underline">
          Back to connectors
        </Link>
      </ProductPageLayout>
    );
  }

  return (
    <ProductPageLayout
      title={detail.source_name}
      description={`${detail.connector_type.replaceAll("_", " ")} · ${detail.status}`}
      actions={
        <div className="flex gap-2">
          <SecondaryButton type="button" onClick={() => void refresh()}>
            Refresh
          </SecondaryButton>
          <GlowCTAButton type="button" onClick={() => void onSyncNow()}>
            Sync now
          </GlowCTAButton>
        </div>
      }
    >
      <p className="mb-4 text-sm">
        <Link to="/connectors" className="text-accent underline">
          ← All connectors
        </Link>
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-text-primary">Sync health</h2>
        <SyncHealthChart logs={logs} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-text-primary">Recent logs</h2>
        <SyncLogsTable logs={logs} sourceName={detail.source_name} />
      </section>
    </ProductPageLayout>
  );
}
