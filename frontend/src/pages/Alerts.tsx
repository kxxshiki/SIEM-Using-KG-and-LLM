import { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Shield, 
  Server, 
  Database, 
  Lock, 
  X, 
  Calendar, 
  Clock, 
  ArrowUpRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AlertItem {
  id: string;
  name: string;
  subCategory: string;
  impactedAssets: number;
  permissions: string;
  connector: string;
  connectorType: 'aws' | 'azure' | 'gcp' | 'cyscale';
  lastSeenAt: string;
  status: 'Open' | 'Resolved' | 'New';
  // Detailed info for modal
  sourceIP: string;
  destinationID: string;
  generatedAt: string;
  whyGenerated: string;
  whatHappened: string;
  recommendedSolution: string;
}

const MOCK_ALERTS: AlertItem[] = [
  {
    id: "1",
    name: "Ensure that SSH access is restricted from the internet",
    subCategory: "Compute | VM",
    impactedAssets: 14,
    permissions: "cyscale-app (Networking | security)",
    connector: "Cyscale Sandbox",
    connectorType: "aws",
    lastSeenAt: "08/02/2024",
    status: "Open",
    sourceIP: "192.168.1.50",
    destinationID: "i-0123456789abcdef0",
    generatedAt: "2024-02-08 14:32:10 UTC",
    whyGenerated: "Security rule SG-SSH-01 detected an inbound rule allowing port 22 access from 0.0.0.0/0.",
    whatHappened: "An external entity scanned port 22 on the target compute instance, potentially exposing the virtual machine to brute-force attacks.",
    recommendedSolution: "Modify the associated Security Group to restrict SSH access to trusted internal IP ranges or VPN gateways only."
  },
  {
    id: "2",
    name: "Ensure Users Have MFA Enabled for Console Access",
    subCategory: "Compute | VM",
    impactedAssets: 12,
    permissions: "ssh-sh (IAM | IAMUser)",
    connector: "Cyscale Sandbox",
    connectorType: "azure",
    lastSeenAt: "17/02/2024",
    status: "Open",
    sourceIP: "10.0.4.12",
    destinationID: "usr-azure-9821",
    generatedAt: "2024-02-17 09:15:40 UTC",
    whyGenerated: "IAM audit policy flagged an active user account lacking multi-factor authentication setup.",
    whatHappened: "User logged into the cloud control plane using password-only authentication, violating organizational security baselines.",
    recommendedSolution: "Enforce a conditional access policy requiring MFA for all IAM users immediately."
  },
  {
    id: "3",
    name: "Ensure that SSH access is restricted from public CIDRs",
    subCategory: "Compute | VM",
    impactedAssets: 26,
    permissions: "neo4j-BROTPR (Networking | security)",
    connector: "Cyscale Sandbox",
    connectorType: "gcp",
    lastSeenAt: "06/03/2024",
    status: "Open",
    sourceIP: "172.16.0.22",
    destinationID: "gcp-instance-prod-3",
    generatedAt: "2024-03-06 18:45:00 UTC",
    whyGenerated: "Cloud firewall rule evaluation matched an overly permissive ingress rule on port 22.",
    whatHappened: "Network telemetry showed persistent connection attempts from unauthorized external subnets.",
    recommendedSolution: "Update GCP VPC firewall rules to block public ingress on port 22 and utilize Identity-Aware Proxy (IAP) instead."
  }
];

export default function Alerts() {
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter(a => 
      a.name.toLowerCase().includes(q) || 
      a.connector.toLowerCase().includes(q) || 
      a.permissions.toLowerCase().includes(q)
    );
  }, [alerts, search]);

  const handleResolve = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Resolved' } : a));
  };

  return (
    <div className="space-y-6 text-slate-100 p-2 sm:p-6 bg-[#0f0e17] min-h-screen">
      {/* Header & Top Dashboard Cards */}
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Summary Card */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Summary</span>
              <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">Today</span>
            </div>
            <div className="my-4 flex items-baseline gap-3">
              <span className="text-3xl font-bold">98%</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <ArrowUpRight size={12} /> 1.50%
              </span>
            </div>
            {/* Visual mini bars */}
            <div className="h-16 flex items-end gap-1.5 pt-2 border-t border-slate-800/60">
              <div className="w-1/3 bg-purple-600/30 h-1/2 rounded-t" />
              <div className="w-1/3 bg-emerald-500/40 h-3/4 rounded-t" />
              <div className="w-1/3 bg-purple-600 h-full rounded-t" />
            </div>
          </Card>

          {/* Trend Card */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Trend</span>
              <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">Today</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 my-2">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> New</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-600" /> Open</span>
            </div>
            <div className="grid grid-cols-7 gap-1 h-16 items-end border-t border-slate-800/60 pt-2 text-center">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((month, idx) => (
                <div key={month} className="flex flex-col items-center gap-1">
                  <div className={cn("w-full rounded-t", idx === 4 ? "bg-purple-600 h-14" : "bg-slate-700/50 h-8")} />
                  <span className="text-[10px] text-slate-500">{month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Open Alerts by Asset Category */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <span className="text-sm font-medium text-slate-400">Open Alerts by Asset Category</span>
            <div className="space-y-3 my-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Networking</span>
                  <span className="font-bold">278</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full w-[75%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Storage</span>
                  <span className="font-bold">305</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[85%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">IAM</span>
                  <span className="font-bold">230</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-purple-400 h-full w-[60%]" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="relative min-w-[280px] flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search identities..."
            className="pl-9 bg-[#181722] border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-[#181722] border-slate-800 text-slate-300 hover:bg-slate-800">
            Search
          </Button>
          <Button variant="outline" size="sm" className="bg-[#181722] border-slate-800 text-slate-300 hover:bg-slate-800 gap-2">
            <Filter size={14} /> Filter
          </Button>
        </div>
      </div>

      {/* Showing Results Table */}
      <Card className="bg-[#181722] border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 text-sm font-semibold text-slate-300">
          Showing {filteredAlerts.length} results
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent text-slate-400">
              <TableHead className="w-10"><input type="checkbox" className="rounded border-slate-700 bg-slate-900" /></TableHead>
              <TableHead className="text-slate-400">Name</TableHead>
              <TableHead className="text-slate-400">Impacted assets</TableHead>
              <TableHead className="text-slate-400">Permissions</TableHead>
              <TableHead className="text-slate-400">Connector</TableHead>
              <TableHead className="text-slate-400">Last seen at</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-right text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAlerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                  No alerts match your filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredAlerts.map((a) => (
                <TableRow 
                  key={a.id} 
                  className="border-slate-800/80 hover:bg-slate-800/40 cursor-pointer transition-colors"
                  onClick={() => setSelectedAlert(a)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-700 bg-slate-900" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 p-1.5 rounded bg-purple-500/10 text-purple-400 shrink-0">
                        <Shield size={14} />
                      </div>
                      <div>
                        <div className="font-medium text-slate-200 line-clamp-1">{a.name}</div>
                        <div className="text-xs text-slate-500">{a.subCategory}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300 font-mono">{a.impactedAssets}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-800 text-slate-300">
                        <Lock size={12} />
                      </div>
                      <span className="text-xs text-slate-300 line-clamp-1">{a.permissions}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="font-semibold text-orange-400 uppercase text-[10px] bg-orange-500/10 px-1.5 py-0.5 rounded">
                        {a.connectorType}
                      </span>
                      {a.connector}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">{a.lastSeenAt}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium inline-block",
                      a.status === 'Open' ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    )}>
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {a.status === 'Open' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs bg-purple-600/20 border-purple-500/40 text-purple-300 hover:bg-purple-600/30 hover:text-white"
                          onClick={(e) => handleResolve(a.id, e)}
                        >
                          Resolve
                        </Button>
                      )}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-slate-400 hover:text-slate-100"
                        onClick={() => setSelectedAlert(a)}
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

      {/* Alert Details Modal / Drawer */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#181722] border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-purple-400" size={20} />
                <h2 className="text-lg font-bold text-slate-100">Alert Details</h2>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="text-slate-400 hover:text-slate-100 h-8 w-8"
                onClick={() => setSelectedAlert(null)}
              >
                <X size={18} />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div>
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">{selectedAlert.subCategory}</span>
                <h3 className="text-base font-semibold text-slate-100 mt-1">{selectedAlert.name}</h3>
              </div>

              {/* Network / Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#13121a] p-4 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Source IP</span>
                  <span className="text-xs font-mono text-purple-300 font-medium">{selectedAlert.sourceIP}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Destination ID</span>
                  <span className="text-xs font-mono text-slate-200 font-medium">{selectedAlert.destinationID}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Time Generated</span>
                  <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                    <Clock size={12} className="text-slate-400" /> {selectedAlert.generatedAt}
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown Sections */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Why the Alert Was Generated</h4>
                  <p className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded border border-slate-800/60 leading-relaxed">
                    {selectedAlert.whyGenerated}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">What Happened</h4>
                  <p className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded border border-slate-800/60 leading-relaxed">
                    {selectedAlert.whatHappened}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Recommended Solution</h4>
                  <p className="text-sm text-emerald-200/90 bg-emerald-500/10 p-3 rounded border border-emerald-500/20 leading-relaxed">
                    {selectedAlert.recommendedSolution}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4 bg-[#13121a]">
              {selectedAlert.status === 'Open' && (
                <Button 
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                  onClick={() => {
                    handleResolve(selectedAlert.id);
                    setSelectedAlert({ ...selectedAlert, status: 'Resolved' });
                  }}
                >
                  <CheckCircle2 size={16} /> Mark as Resolved
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