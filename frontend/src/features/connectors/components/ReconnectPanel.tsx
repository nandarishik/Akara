import { ConnectorWizard } from "./ConnectorWizard";
import type { ConnectorType } from "../api/types";

type Props = {
  open: boolean;
  connectorType: ConnectorType;
  sourceName: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

/** Reconnect always opens the wizard with blank secrets (never re-display). */
export function ReconnectPanel({
  open,
  connectorType,
  sourceName,
  onClose,
  onCreated,
}: Props) {
  return (
    <ConnectorWizard
      open={open}
      onClose={onClose}
      reconnect={{ connectorType, sourceName }}
      onCreated={onCreated}
    />
  );
}
