import { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Shield, 
  Lock, 
  X, 
  Clock, 
  ArrowUpRight,
  Upload,
  Box
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
  assetCategory: 'Networking' | 'Storage' | 'IAM' | 'Compute';
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
    assetCategory: "Networking",
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
    assetCategory: "IAM",
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
    assetCategory: "Storage",
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
  // Toggle this to true/false to simulate whether logs have been uploaded
  const [isLogsUploaded, setIsLogsUploaded] = useState(false);
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

  // Tooltip hover states for interactive charts
  const [activeTooltip, setActiveTooltip] = useState<{ type: string; title: string; subtitle: string; color: string } | null>(null);

  const filteredAlerts = useMemo(() => {
    if (!isLogsUploaded) return [];
    const q = search.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter(a => 
      a.name.toLowerCase().includes(q) || 
      a.connector.toLowerCase().includes(q) || 
      a.permissions.toLowerCase().includes(q)
    );
  }, [alerts, search, isLogsUploaded]);

  const handleResolve = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Resolved' } : a));
  };

  const resolvedCount = alerts.filter(a => a.status === 'Resolved').length;

  return (
    <div className="space-y-6 text-slate-100 p-2 sm:p-6 bg-[#0f0e17] min-h-screen relative">
      {/* Header & 4 Top Header Rows Cards */}
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Summary */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Summary</span>
              <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">Today</span>
            </div>
            <div className="my-4 flex items-baseline gap-3">
              <span className="text-3xl font-bold">{isLogsUploaded ? "98%" : "—%"}</span>
              {isLogsUploaded && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <ArrowUpRight size={12} /> 1.50%
                </span>
              )}
            </div>
            {/* Visual mini bars */}
            <div className="h-16 flex items-end gap-1.5 pt-2 border-t border-slate-800/60">
              <div className={cn("w-1/3 rounded-t transition-all", isLogsUploaded ? "bg-purple-600/30 h-1/2" : "bg-slate-800 h-2")} />
              <div className={cn("w-1/3 rounded-t transition-all", isLogsUploaded ? "bg-emerald-500/40 h-3/4" : "bg-slate-800 h-2")} />
              <div className={cn("w-1/3 rounded-t transition-all", isLogsUploaded ? "bg-purple-600 h-full" : "bg-slate-800 h-2")} />
            </div>
          </Card>

          {/* Card 2: Source */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Source</span>
              <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">Live</span>
            </div>
            <div className="my-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">AWS:</span>
                <span className="font-mono font-medium text-slate-200">{isLogsUploaded ? "178" : "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Azure:</span>
                <span className="font-mono font-medium text-slate-200">{isLogsUploaded ? "105" : "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">GCP:</span>
                <span className="font-mono font-medium text-slate-200">{isLogsUploaded ? "82" : "—"}</span>
              </div>
            </div>
            <div className="h-10 border-t border-slate-800/60 pt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Total Sources</span>
              <span className="font-mono font-bold text-purple-400">{isLogsUploaded ? "365" : "—"}</span>
            </div>
          </Card>

          {/* Card 3: Resolved Alerts */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Resolved Alerts</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Active</span>
            </div>
            <div className="my-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-emerald-400">
                {isLogsUploaded ? resolvedCount : "—"}
              </span>
              {isLogsUploaded && <span className="text-xs text-slate-400">resolved today</span>}
            </div>
            <div className="h-16 border-t border-slate-800/60 pt-2 flex items-center">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className={cn("h-full bg-emerald-500 transition-all", isLogsUploaded ? "w-[65%]" : "w-0")} />
              </div>
            </div>
          </Card>

          {/* Card 4: Open Alerts by Asset Category */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <span className="text-sm font-medium text-slate-400">Open Alerts by Asset Category</span>
            <div className="space-y-2.5 my-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Networking</span>
                  <span className="font-bold font-mono">{isLogsUploaded ? "278" : "—"}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn("h-full bg-purple-500 transition-all", isLogsUploaded ? "w-[75%]" : "w-0")} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Storage</span>
                  <span className="font-bold font-mono">{isLogsUploaded ? "305" : "—"}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn("h-full bg-emerald-500 transition-all", isLogsUploaded ? "w-[85%]" : "w-0")} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">IAM</span>
                  <span className="font-bold font-mono">{isLogsUploaded ? "230" : "—"}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn("h-full bg-purple-400 transition-all", isLogsUploaded ? "w-[60%]" : "w-0")} />
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>

      {/* CONDITIONAL RENDER: Pre-Upload State vs Post-Upload Live Charts */}
      {!isLogsUploaded ? (
        /* Pre-Upload Empty State Banner */
        <Card className="bg-[#181722] border-slate-800 p-12 text-center flex flex-col items-center justify-center space-y-4 my-6">
          <div className="p-4 rounded-full bg-purple-500/10 text-purple-400">
            <Box size={36} />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-lg font-semibold text-slate-200">No Log Files Uploaded</h3>
            <p className="text-sm text-slate-400">
              Upload Log Files to view live data, charts, and detections.
            </p>
          </div>
          <Button 
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 mt-2"
            onClick={() => setIsLogsUploaded(true)}
          >
            <Upload size={16} /> Upload Logs
          </Button>
        </Card>
      ) : (
        /* Post-Upload Live Graphs & Charts Section */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          
          {/* Trend & Activity Line Graph */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">Threat Detection Trend</span>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> New</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Open</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> IAM</span>
              </div>
            </div>
            
            <div className="h-48 w-full relative flex items-end justify-between px-2 pt-6 border-b border-slate-800">
              {/* Interactive Hoverable Bar/Point columns */}
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((month, idx) => (
                <div 
                  key={month} 
                  className="h-full flex flex-col items-center justify-end flex-1 relative group cursor-pointer"
                  onMouseEnter={() => setActiveTooltip({
                    type: 'Trend',
                    title: `Month: ${month}`,
                    subtitle: `New Alerts: ${120 + idx * 15} | Open: ${80 + idx * 10}`,
                    color: 'text-purple-400'
                  })}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <div className="w-2 bg-purple-500 rounded-t transition-all group-hover:bg-purple-400" style={{ height: `${40 + idx * 10}%` }} />
                  <span className="text-[10px] text-slate-500 mt-2">{month}</span>
                </div>
              ))}
            </div>
            {activeTooltip && (
              <div className="text-xs bg-slate-900 border border-slate-700 p-2 rounded mt-2 text-slate-300">
                <span className={cn("font-bold block", activeTooltip.color)}>{activeTooltip.title}</span>
                <span>{activeTooltip.subtitle}</span>
              </div>
            )}
          </Card>

          {/* Scatter Plot / Asset Correlation Chart */}
          <Card className="bg-[#181722] border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">Asset Risk Correlation</span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">Live Telemetry</span>
            </div>
            
            <div className="h-48 w-full relative border-b border-slate-800 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-around p-4">
                {/* Simulated live scatter points with hover labels */}
                {[
                  { x: '20%', y: '30%', color: 'bg-purple-500', label: 'Networking Asset #102' },
                  { x: '45%', y: '60%', color: 'bg-emerald-400', label: 'Storage Bucket S3-Prod' },
                  { x: '70%', y: '40%', color: 'bg-blue-400', label: 'IAM Root Policy Group' },
                  { x: '85%', y: '80%', color: 'bg-purple-400', label: 'Compute Cluster VM-04' },
                ].map((pt, i) => (
                  <div 
                    key={i}
                    className={cn("w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-150 shadow-lg", pt.color)}
                    style={{ position: 'absolute', left: pt.x, bottom: pt.y }}
                    onMouseEnter={() => setActiveTooltip({
                      type: 'Scatter',
                      title: pt.label,
                      subtitle: `Risk Level: High | Confidence: 94%`,
                      color: 'text-emerald-400'
                    })}
                    onMouseLeave={() => setActiveTooltip(null)}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500 italic">Hover points to inspect live asset metadata</span>
            </div>
            {activeTooltip && activeTooltip.type === 'Scatter' && (
              <div className="text-xs bg-slate-900 border border-slate-700 p-2 rounded mt-2 text-slate-300">
                <span className={cn("font-bold block", activeTooltip.color)}>{activeTooltip.title}</span>
                <span>{activeTooltip.subtitle}</span>
              </div>
            )}
          </Card>

        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="relative min-w-[280px] flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search identities..."
            disabled={!isLogsUploaded}
            className="pl-9 bg-[#181722] border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-purple-500 disabled:opacity-50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!isLogsUploaded} className="bg-[#181722] border-slate-800 text-slate-300 hover:bg-slate-800">
            Search
          </Button>
          <Button variant="outline" size="sm" disabled={!isLogsUploaded} className="bg-[#181722] border-slate-800 text-slate-300 hover:bg-slate-800 gap-2">
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
              <TableHead className="w-10"><input type="checkbox" disabled={!isLogsUploaded} className="rounded border-slate-700 bg-slate-900" /></TableHead>
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
            {!isLogsUploaded || filteredAlerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-slate-500">
                  {!isLogsUploaded ? "Upload log files to generate detections and view live data." : "No alerts match your filter criteria."}
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