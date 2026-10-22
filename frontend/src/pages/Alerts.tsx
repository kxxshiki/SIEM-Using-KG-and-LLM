
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Shield,
  X,
  Clock,
  RefreshCw,
  BrainCircuit,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { alertsApi } from "@/api/alertsApi";
import type { Alert, AlertStatus } from "@/types/alert.types";

const statusStyles: Record<AlertStatus, string> = {
  NEW: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  UNDER_INVESTIGATION:
    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  CONFIRMED_THREAT:
    "bg-red-500/15 text-red-300 border-red-500/30",
  FALSE_POSITIVE:
    "bg-slate-500/15 text-slate-300 border-slate-500/30",
  RESOLVED:
    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const statusLabels: Record<AlertStatus, string> = {
  NEW: "New",
  UNDER_INVESTIGATION: "Investigating",
  CONFIRMED_THREAT: "Confirmed Threat",
  FALSE_POSITIVE: "False Positive",
  RESOLVED: "Resolved",
};

function getErrorMessage(error: unknown): string {
  const apiError = error as {
    response?: { data?: { detail?: string } };
    message?: string;
  };

  return (
    apiError.response?.data?.detail ||
    apiError.message ||
    "Something went wrong. Please try again."
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionAlertId, setActionAlertId] = useState<number | null>(null);

  const loadAlerts = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);

    try {
      const data = await alertsApi.getAlerts();

      setAlerts(data);
      setPageError("");

      // Keep an open details modal synchronized with the latest server data.
      setSelectedAlert((current) => {
        if (!current) return null;
        return data.find((alert) => alert.id === current.id) ?? current;
      });
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  // Load actual alerts when the page opens.
  useEffect(() => {
    void loadAlerts(true);
  }, [loadAlerts]);

  // Poll while an AI investigation is running. The backend saves its result
  // asynchronously, so the first Investigate response may not contain it.
  const hasRunningInvestigation = alerts.some(
    (alert) => alert.status === "UNDER_INVESTIGATION",
  );

  useEffect(() => {
    if (!hasRunningInvestigation) return;

    const timer = window.setInterval(() => {
      void loadAlerts();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [hasRunningInvestigation, loadAlerts]);

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return alerts;

    return alerts.filter((alert) =>
      [
        alert.alert_type,
        alert.rule_name,
        alert.severity,
        alert.status,
        alert.ip_address,
        alert.description,
        alert.investigation_reason,
        alert.mitre_technique_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [alerts, search]);

  const resolvedCount = alerts.filter(
    (alert) => alert.status === "RESOLVED",
  ).length;

  const investigatingCount = alerts.filter(
    (alert) => alert.status === "UNDER_INVESTIGATION",
  ).length;

  const highRiskCount = alerts.filter((alert) =>
    ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase()),
  ).length;

  const handleInvestigate = async (alert: Alert) => {
    setActionError("");
    setActionAlertId(alert.id);

    try {
      const updated = await alertsApi.investigateAlert(String(alert.id));

      setAlerts((current) =>
        current.map((item) => (item.id === alert.id ? updated : item)),
      );
      setSelectedAlert(updated);

      // Fetch again in case the background task has already finished.
      await loadAlerts();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setActionAlertId(null);
    }
  };

  const handleResolve = async (alert: Alert) => {
    setActionError("");
    setActionAlertId(alert.id);

    try {
      const updated = await alertsApi.resolveAlert(String(alert.id));

      setAlerts((current) =>
        current.map((item) => (item.id === alert.id ? updated : item)),
      );
      setSelectedAlert(updated);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setActionAlertId(null);
    }
  };

  const canInvestigate = (alert: Alert) =>
    alert.status !== "UNDER_INVESTIGATION" &&
    alert.status !== "RESOLVED";

  return (
    <div className="relative min-h-screen space-y-6 bg-[#0f0e17] p-2 text-slate-100 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Security detections and AI-powered investigations
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => void loadAlerts(true)}
          className="gap-2 border-slate-700 bg-[#181722] text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw
            size={14}
            className={isLoading ? "animate-spin" : ""}
          />
          Refresh
        </Button>
      </div>

      {pageError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{pageError}</p>
            <p className="mt-1 text-xs text-red-300/80">
              Check that the backend is running and your session is
              authenticated.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadAlerts(true)}
            className="border-red-500/30 text-red-200"
          >
            Retry
          </Button>
        </div>
      )}

      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <span>{actionError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setActionError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex flex-col justify-between border-slate-800 bg-[#181722] p-5">
          <span className="text-sm text-slate-400">Total Alerts</span>
          <span className="mt-4 text-3xl font-bold">
            {isLoading ? "—" : alerts.length}
          </span>
          <span className="mt-2 text-xs text-slate-500">
            Retrieved from the backend
          </span>
        </Card>

        <Card className="flex flex-col justify-between border-slate-800 bg-[#181722] p-5">
          <span className="text-sm text-slate-400">High / Critical</span>
          <span className="mt-4 text-3xl font-bold text-red-300">
            {isLoading ? "—" : highRiskCount}
          </span>
          <span className="mt-2 text-xs text-slate-500">
            Alerts with elevated severity
          </span>
        </Card>

        <Card className="flex flex-col justify-between border-slate-800 bg-[#181722] p-5">
          <span className="text-sm text-slate-400">Investigating</span>
          <span className="mt-4 text-3xl font-bold text-amber-300">
            {isLoading ? "—" : investigatingCount}
          </span>
          <span className="mt-2 text-xs text-slate-500">
            AI analysis may still be running
          </span>
        </Card>

        <Card className="flex flex-col justify-between border-slate-800 bg-[#181722] p-5">
          <span className="text-sm text-slate-400">Resolved Alerts</span>
          <span className="mt-4 text-3xl font-bold text-emerald-300">
            {isLoading ? "—" : resolvedCount}
          </span>
          <span className="mt-2 text-xs text-slate-500">
            Resolved in the current alert list
          </span>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-xl flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search alert, severity, IP, or AI findings..."
            className="border-slate-800 bg-[#181722] pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:ring-purple-500"
          />
        </div>
        <span className="text-sm text-slate-400">
          {filteredAlerts.length} result(s)
        </span>
      </div>

      <Card className="overflow-hidden border-slate-800 bg-[#181722]">
        <div className="border-b border-slate-800 p-4 text-sm font-semibold text-slate-300">
          Security Alerts
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Alert</TableHead>
              <TableHead className="text-slate-400">Severity</TableHead>
              <TableHead className="text-slate-400">Risk Score</TableHead>
              <TableHead className="text-slate-400">Source IP</TableHead>
              <TableHead className="text-slate-400">Created</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-right text-slate-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && alerts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-16 text-center text-slate-400"
                >
                  <Loader2 className="mx-auto mb-2 animate-spin" size={22} />
                  Loading alerts...
                </TableCell>
              </TableRow>
            ) : filteredAlerts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-16 text-center text-slate-500"
                >
                  {search
                    ? "No alerts match your search."
                    : "No alerts found. Upload or ingest logs to generate detections."}
                </TableCell>
              </TableRow>
            ) : (
              filteredAlerts.map((alert) => (
                <TableRow
                  key={alert.id}
                  className="cursor-pointer border-slate-800/80 transition-colors hover:bg-slate-800/40"
                  onClick={() => setSelectedAlert(alert)}
                >
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0 rounded bg-purple-500/10 p-1.5 text-purple-300">
                        <Shield size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 font-medium text-slate-200">
                          {alert.rule_name || alert.alert_type}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          ID {alert.id} · {alert.alert_type}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200">
                      {alert.severity}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono text-slate-300">
                    {Number(alert.risk_score).toFixed(1)}
                  </TableCell>

                  <TableCell className="font-mono text-xs text-slate-300">
                    {alert.ip_address || "—"}
                  </TableCell>

                  <TableCell className="text-xs text-slate-400">
                    {formatDate(alert.created_at)}
                  </TableCell>

                  <TableCell>
                    <span
                      className={cn(
                        "inline-block rounded-full border px-2.5 py-1 text-xs font-medium",
                        statusStyles[alert.status],
                      )}
                    >
                      {statusLabels[alert.status]}
                    </span>
                  </TableCell>

                  <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {canInvestigate(alert) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionAlertId === alert.id}
                          className="h-8 gap-1.5 border-purple-500/40 bg-purple-600/15 text-xs text-purple-200 hover:bg-purple-600/30 hover:text-white"
                          onClick={() => void handleInvestigate(alert)}
                        >
                          {actionAlertId === alert.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <BrainCircuit size={13} />
                          )}
                          Investigate
                        </Button>
                      )}

                      {alert.status !== "RESOLVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionAlertId === alert.id}
                          className="h-8 border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => void handleResolve(alert)}
                        >
                          <CheckCircle2 size={13} className="mr-1" />
                          Resolve
                        </Button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`View alert ${alert.id}`}
                        className="h-8 w-8 text-slate-400 hover:text-white"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedAlert(null);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-800 bg-[#181722] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-purple-400" size={20} />
                <h2 className="text-lg font-bold text-slate-100">
                  Alert Details
                </h2>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close alert details"
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={() => setSelectedAlert(null)}
              >
                <X size={18} />
              </Button>
            </div>

            <div className="max-h-[calc(90vh-140px)] space-y-5 overflow-y-auto p-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                  {selectedAlert.alert_type}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">
                  {selectedAlert.rule_name}
                </h3>
                {selectedAlert.description && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {selectedAlert.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-[#13121a] p-4 sm:grid-cols-3">
                <div>
                  <span className="mb-1 block text-[11px] text-slate-400">
                    Source IP
                  </span>
                  <span className="break-all font-mono text-sm text-purple-300">
                    {selectedAlert.ip_address || "—"}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] text-slate-400">
                    Risk Score
                  </span>
                  <span className="font-mono text-sm text-slate-200">
                    {selectedAlert.risk_score}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] text-slate-400">
                    Confidence
                  </span>
                  <span className="font-mono text-sm text-slate-200">
                    {selectedAlert.confidence}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] text-slate-400">
                    Created
                  </span>
                  <span className="text-xs text-slate-300">
                    {formatDate(selectedAlert.created_at)}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] text-slate-400">
                    Investigated By
                  </span>
                  <span className="text-sm text-slate-300">
                    {selectedAlert.investigated_by || "—"}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] text-slate-400">
                    Investigation Started
                  </span>
                  <span className="text-xs text-slate-300">
                    {formatDate(selectedAlert.investigated_at)}
                  </span>
                </div>
              </div>

              {selectedAlert.mitre_technique_id && (
                <div className="rounded-lg border border-slate-800 p-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    MITRE ATT&CK
                  </h4>
                  <p className="text-sm text-slate-200">
                    {selectedAlert.mitre_technique_id}
                    {selectedAlert.mitre_technique_name
                      ? ` — ${selectedAlert.mitre_technique_name}`
                      : ""}
                  </p>
                  {selectedAlert.mitre_tactic && (
                    <p className="mt-1 text-xs text-slate-400">
                      Tactic: {selectedAlert.mitre_tactic}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={17} className="text-purple-300" />
                  <h4 className="text-sm font-semibold text-purple-200">
                    AI Investigation
                  </h4>
                </div>

                {selectedAlert.status === "UNDER_INVESTIGATION" &&
                !selectedAlert.investigation_reason ? (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                    <Loader2 size={18} className="animate-spin" />
                    <div>
                      <p className="font-medium">Investigation in progress</p>
                      <p className="mt-1 text-xs text-amber-200/70">
                        Waiting for the backend to save the Ollama analysis.
                        This panel refreshes automatically while the
                        investigation is running.
                      </p>
                    </div>
                  </div>
                ) : selectedAlert.investigation_reason ? (
                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-purple-500/20 bg-slate-900/70 p-4 font-sans text-sm leading-relaxed text-slate-200">
                    {selectedAlert.investigation_reason}
                  </pre>
                ) : (
                  <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
                    No investigation result has been saved yet. Click
                    Investigate to analyze the associated log and available
                    graph context.
                  </p>
                )}
              </div>

              {selectedAlert.recommended_action && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Recommended Action
                  </h4>
                  <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-relaxed text-emerald-100">
                    {selectedAlert.recommended_action}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 bg-[#13121a] px-6 py-4">
              {canInvestigate(selectedAlert) && (
                <Button
                  disabled={actionAlertId === selectedAlert.id}
                  className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
                  onClick={() => void handleInvestigate(selectedAlert)}
                >
                  {actionAlertId === selectedAlert.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <BrainCircuit size={16} />
                  )}
                  Investigate with AI
                </Button>
              )}

              {selectedAlert.status !== "RESOLVED" && (
                <Button
                  disabled={actionAlertId === selectedAlert.id}
                  variant="outline"
                  className="gap-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => void handleResolve(selectedAlert)}
                >
                  <CheckCircle2 size={16} />
                  Mark Resolved
                </Button>
              )}

              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setSelectedAlert(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
