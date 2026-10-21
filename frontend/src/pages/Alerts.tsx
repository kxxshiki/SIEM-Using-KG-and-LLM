import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useCachedQuery } from "@/lib/queryCache";
import { cn, formatDateTime } from "@/lib/utils";
import type { Alert, AlertListResponse } from "@/types";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge, { ALERT_STATUSES, statusLabel } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 25;
const COLUMNS = 9;

function sourceOf(a: Alert): string {
  const src = a.detected_by ?? (a.rule_name?.startsWith("ml_") ? "ml_engine" : "rule_engine");
  return src === "ml_engine" ? "ML engine" : "Rule engine";
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs italic text-muted-foreground">pending…</span>;
  const color = value >= 75 ? "bg-red-500" : value >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex min-w-[96px] items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">{value.toFixed(0)}</span>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function Alerts() {
 
  const [page, setPage] = useState(0);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(true);
  const [actionError, setActionError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, error, refresh, mutate } = useCachedQuery<AlertListResponse>(
    `alerts:${page}:${severity}:${status}`,
    () => {
      const params: Record<string, string | number> = { skip: page * PAGE_SIZE, limit: PAGE_SIZE };
      if (severity) params.severity = severity;
      if (status) params.status = status;
      return api.get<AlertListResponse>("/alerts", { params }).then((r) => r.data);
    },
    { pollMs: live ? 5000 : 0 } // live monitoring, without flashing a loading state
  );
  const alerts = data?.alerts ?? [];
  const total = data?.total ?? 0;
  const loading = data === undefined && !error;
  const errorText = error ? getErrorMessage(error, "Could not load alerts") : "";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter((a) =>
      [a.alert_type, a.ip_address ?? "", a.mitre_technique_id ?? "", a.mitre_technique_name ?? ""].some((v) =>
        v.toLowerCase().includes(q)
      )
    );
  }, [alerts, search]);

  const replaceAlert = (updated: Alert) =>
    mutate((prev) =>
      prev ? { ...prev, alerts: prev.alerts.map((a) => (a.id === updated.id ? updated : a)) } : prev
    );

  const overrideStatus = async (alert: Alert, newStatus: string) => {
    if (newStatus === alert.status) return;
    setBusyId(alert.id);
    setActionError("");
    try {
      const res = await api.put<Alert>(`/alerts/${alert.id}/action`, { action: newStatus });
      replaceAlert(res.data);
    } catch (err) {
      setActionError(getErrorMessage(err, "Could not update the status"));
    } finally {
      setBusyId(null);
    }
  };

  const reinvestigate = async (alert: Alert) => {
    setBusyId(alert.id);
    setActionError("");
    try {
      const res = await api.post<Alert>(`/alerts/${alert.id}/investigate`);
      replaceAlert(res.data);
    } catch (err) {
      setActionError(getErrorMessage(err, "Investigation failed"));
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Security</p>
          <h1 className="text-2xl font-bold tracking-tight">Alert Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alerts are investigated automatically. Click a row to see the AI's reasoning — you can override any status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={live ? "secondary" : "outline"} size="sm" onClick={() => setLive((l) => !l)}>
            <span className="relative flex h-2 w-2">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />}
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", live ? "bg-green-500" : "bg-muted-foreground")} />
            </span>
            Live {live ? "on" : "off"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter this page by IP, threat or MITRE ID…"
            className="pl-9"
          />
        </div>
        <Select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All statuses</option>
          {ALERT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
      </div>

      {errorText && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
          {errorText}
        </div>
      )}
      {actionError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
          {actionError}
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>Time</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead>Source IP</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Detected by</TableHead>
              <TableHead>MITRE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={COLUMNS}>
                    <div className="h-5 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS} className="py-16 text-center text-muted-foreground">
                  No alerts found. Upload a log file to generate detections.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((a) => {
                const expanded = expandedId === a.id;
                const busy = busyId === a.id;
                return (
                  <Fragment key={a.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : a.id)}
                    >
                      <TableCell className="text-muted-foreground">
                        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDateTime(a.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{a.alert_type}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{a.rule_name}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-primary">{a.ip_address ?? "—"}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={a.severity} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell>
                        <ConfidenceBar value={a.confidence_score} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{sourceOf(a)}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {a.mitre_technique_id ? (
                          <span title={`${a.mitre_technique_name ?? ""} · ${a.mitre_tactic ?? ""}`}>
                            {a.mitre_technique_id}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {expanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={COLUMNS} className="px-6 py-5">
                          <div className="grid gap-6 lg:grid-cols-3">
                            <div className="space-y-4 lg:col-span-2">
                              <Detail label="Why it was classified this way">
                                {a.investigation_reason ??
                                  "Investigation has not finished yet — it runs automatically in the background."}
                              </Detail>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <Detail label="Investigation result">{a.investigation_result ?? "—"}</Detail>
                                <Detail label="Recommended action">{a.recommended_action ?? "—"}</Detail>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <Detail label="Related events">{a.related_event_count ?? "—"}</Detail>
                                <Detail label="Detection score">{a.risk_score.toFixed(0)} / 100</Detail>
                                <Detail label="Investigated by">{a.investigated_by ?? "—"}</Detail>
                                <Detail label="Investigated at">{formatDateTime(a.investigated_at)}</Detail>
                              </div>
                              <Detail label="MITRE ATT&CK">
                                {a.mitre_technique_id ? (
                                  <>
                                    <span className="font-mono">{a.mitre_technique_id}</span> — {a.mitre_technique_name}
                                    <span className="block text-xs text-muted-foreground">
                                      Tactic: {a.mitre_tactic}
                                    </span>
                                  </>
                                ) : (
                                  "Not mapped"
                                )}
                              </Detail>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void reinvestigate(a)}>
                              Re-investigate
                            </Button>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              Override status
                              <Select
                                className="h-8 text-xs"
                                value={a.status}
                                disabled={busy}
                                onChange={(e) => void overrideStatus(a, e.target.value)}
                              >
                                {ALERT_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {statusLabel(s)}
                                  </option>
                                ))}
                              </Select>
                            </label>
                            {busy && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            {from}–{to} of {total.toLocaleString()} alerts
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} /> Prev
            </Button>
            <span>
              Page {page + 1} / {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}