import { Upload } from "lucide-react"
import { Link } from "react-router-dom"

import EmptyState from "@/shared/ui/EmptyState"

export function DashboardEmptyState() {
  return (
    <EmptyState
      icon={<Upload className="h-7 w-7" />}
      title="Your dashboard awaits data"
      description="Upload your sales file to unlock KPIs, zone charts, and weekly debriefs."
      primaryAction={{ label: "Upload sales data", href: "/data" }}
      secondaryAction={{ label: "Learn about imports", href: "/data" }}
    >
      <p className="text-xs text-text-muted">
        No KPI data yet —{" "}
        <Link to="/data" className="text-accent underline">
          go to Data
        </Link>{" "}
        to upload.
      </p>
    </EmptyState>
  )
}
