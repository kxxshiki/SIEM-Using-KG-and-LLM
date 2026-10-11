import { cn } from "@/lib/utils";

export const ALERT_STATUSES = [
  "NEW",
  "UNDER_INVESTIGATION",
  "CONFIRMED_THREAT",
  "FALSE_POSITIVE",
  "RESOLVED",
] as const;

const META: Record<string, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  UNDER_INVESTIGATION: {
    label: "Under investigation",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  CONFIRMED_THREAT: {
    label: "Confirmed threat",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  },
  FALSE_POSITIVE: {
    label: "False positive",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
  RESOLVED: { label: "Resolved", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
};

export function statusLabel(status: string): string {
  return META[status]?.label ?? status;
}

export default function StatusBadge({ status }: { status: string }) {
  const meta = META[status] ?? { label: status, className: "border-border bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}