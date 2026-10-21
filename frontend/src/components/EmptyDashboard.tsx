import { Link } from "react-router-dom";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const METRICS = ["Total logs", "Total alerts", "Threats today", "Critical open", "Confirmed threats"];
const PANELS = [
  "Threat trend", "Attack types", "Log volume", "Alert status",
  "Top threat source IPs", "Top source countries",
];

export type EmptyState = "checking" | "empty" | "failed";

export default function EmptyDashboard({ state, onRetry }: { state: EmptyState; onRetry?: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Overview</p>
        <h1 className="text-2xl font-bold tracking-tight">Security Dashboard</h1>
      </div>

      {state === "empty" && (
        <div role="status" className="rounded-lg border bg-card p-6 text-center">
          <p className="font-medium">No logs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload logs to see your security overview. Nothing is shown until then.
          </p>
          <Link to="/sources" className="mt-4 inline-block">
            <Button type="button" variant="gradient">
              <Upload size={16} aria-hidden="true" />
              Upload logs
            </Button>
          </Link>
        </div>
      )}

      {state === "failed" && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <span>Could not load the dashboard. Check that the backend is running.</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map((label) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold text-muted-foreground">
              <span aria-hidden="true">—</span>
              <span className="sr-only">No data yet</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PANELS.map((label) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">{label}</p>
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}