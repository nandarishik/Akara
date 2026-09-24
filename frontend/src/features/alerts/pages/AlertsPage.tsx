import { Navigate } from "react-router-dom";

/** Legacy `/alerts` shell — café rules live at `/settings/alerts`. */
export function AlertsPage() {
  return <Navigate to="/settings/alerts" replace />;
}
