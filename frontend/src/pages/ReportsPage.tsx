import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useReports, useSchemeLeakage } from "@/hooks/useReports";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

function formatINR(v: number) {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

async function downloadReport(reportId: string, title: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  const res = await fetch(`${BASE}/reports/${reportId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const {
    data: reports,
    isLoading: reportsLoading,
    refetch,
  } = useReports();

  const { data: leakageRows } = useSchemeLeakage();

  const totalLeakage = (leakageRows || []).reduce(
    (sum, r) => sum + r.leakage_amount,
    0
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generated reports, exports, and scheme leakage analysis
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Scheme Leakage Card — only shown when data is available */}
      {leakageRows && leakageRows.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base text-red-800">
                  Scheme Leakage Detected
                </CardTitle>
                <CardDescription className="text-red-600 mt-0.5">
                  Distributors claiming more than actual secondary offtake
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-red-300 text-red-700 bg-white shrink-0"
              >
                {leakageRows.length} distributor{leakageRows.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {leakageRows.slice(0, 5).map((row, i) => (
              <div
                key={i}
                className="flex items-start justify-between text-sm py-2 border-b border-red-100 last:border-0"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-red-900">{row.party_name}</p>
                  <p className="text-xs text-red-600">
                    {row.scheme_name} · {row.product_name}
                  </p>
                  <p className="text-xs text-red-500">
                    {row.scheme_start} → {row.scheme_end}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-semibold text-red-800">
                    {formatINR(row.leakage_amount)} deniable
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">
                    Claimed {formatINR(row.claimed_amount)}, actual{" "}
                    {formatINR(row.actual_offtake)}
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-red-800">
                Total deniable this cycle: {formatINR(totalLeakage)}
              </p>
              {leakageRows.length > 5 && (
                <p className="text-xs text-red-500">
                  +{leakageRows.length - 5} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Reports List */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Generated Reports
        </h2>

        {reportsLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {!reportsLoading && (!reports || reports.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <FileSpreadsheet className="h-8 w-8 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No reports yet</p>
              <p className="text-sm mt-1 text-slate-400">
                Reports will appear here once generated by the system or an admin
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {(reports || []).map((r) => (
            <Card
              key={r.id}
              className="hover:shadow-sm transition-shadow"
            >
              <CardContent className="flex items-center justify-between py-4 px-5">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-slate-900">
                      {r.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {r.report_type}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {r.file_size_bytes && (
                        <span className="text-xs text-slate-400">
                          {(r.file_size_bytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadReport(r.id, r.title)}
                  disabled={!r.storage_path}
                  className="shrink-0 ml-4"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
