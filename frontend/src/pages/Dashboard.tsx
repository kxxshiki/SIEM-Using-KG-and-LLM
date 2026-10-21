import { useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, AlertTriangle, Bell, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useCachedQuery } from "@/lib/queryCache";
import { parseServerDate } from "@/lib/utils";
import type { DashboardSummary } from "@/types";
import EmptyDashboard from "@/components/EmptyDashboard";
import StatCard from "@/components/StatCard";
import { statusLabel } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PALETTE = ["#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"];
const STATUS_COLORS: Record<string, string> = {
  NEW: "#3b82f6",
  UNDER_INVESTIGATION: "#f59e0b",
  CONFIRMED_THREAT: "#ef4444",
  FALSE_POSITIVE: "#64748b",
  RESOLVED: "#22c55e",
};

const AXIS = { fill: "#94a3b8", fontSize: 11 };
const GRID = "rgba(148,163,184,0.2)";
const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

function ChartCard({
  title, subtitle, empty, className, children,
}: {
  title: string;
  subtitle?: string;
  empty: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No data yet
          </div>
        ) : (
          <div className="h-[220px]">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, error, refresh, mutate } = useCachedQuery<DashboardSummary>(
    "dashboard-summary",
    () => api.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),
    { pollMs: 10000 }
  );
  const [refreshing, setRefreshing] = useState(false);

  // The Refresh button asks the server to skip its cache
  const forceRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.get<DashboardSummary>("/dashboard/summary", { params: { refresh: true } });
      mutate(() => res.data);
    } catch {
      /* the next automatic refresh will show the problem */
    } finally {
      setRefreshing(false);
    }
  };

  // Before the first answer: dashes only, never numbers. After it: empty state or real data.
  if (!data) return <EmptyDashboard state={error ? "failed" : "checking"} onRetry={() => void refresh()} />;
  if (!data.has_data) return <EmptyDashboard state="empty" />;

  const statusData = data.status_breakdown.map((s) => ({
    key: s.name,
    name: statusLabel(s.name),
    count: s.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Overview</p>
          <h1 className="text-2xl font-bold tracking-tight">Security Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity size={12} /> Updated {parseServerDate(data.generated_at).toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={() => void forceRefresh()} disabled={refreshing}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
          Could not refresh the dashboard. Showing the last data.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total logs" value={data.total_logs} icon={Activity} />
        <StatCard title="Total alerts" value={data.total_alerts} icon={Bell} />
        <StatCard title="Threats today" value={data.threats_today} icon={AlertTriangle} hint="UTC day" />
        <StatCard
          title="Critical open"
          value={data.critical_open_alerts}
          icon={ShieldAlert}
          hint="Not yet resolved"
          danger={data.critical_open_alerts > 0}
        />
        <StatCard title="Confirmed threats" value={data.confirmed_threats} icon={ShieldCheck} hint="By AI investigation" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Threat trend"
          subtitle="Alerts created per day, last 7 days"
          empty={data.threat_trend.every((d) => d.count === 0)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.threat_trend}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="count" name="Alerts" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Attack types" subtitle="Share of all alerts" empty={data.attack_types.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.attack_types} dataKey="count" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {data.attack_types.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Log volume"
          subtitle="Logs ingested per day, last 7 days"
          empty={data.log_volume.every((d) => d.count === 0)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.log_volume}>
              <defs>
                <linearGradient id="logGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="count" name="Logs" stroke="#8b5cf6" strokeWidth={2} fill="url(#logGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Alert status" subtitle="Where alerts are in their lifecycle" empty={statusData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} interval={0} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="count" name="Alerts" radius={[4, 4, 0, 0]}>
                {statusData.map((s) => (
                  <Cell key={s.key} fill={STATUS_COLORS[s.key] ?? "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top threat source IPs" subtitle="Most alerts per IP" empty={data.top_ips.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.top_ips} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={AXIS} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ ...AXIS, fontFamily: "JetBrains Mono, monospace", fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="count" name="Alerts" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top source countries" subtitle="Where alert-triggering logs came from" empty={data.top_countries.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.top_countries}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} interval={0} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="count" name="Alerts" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}