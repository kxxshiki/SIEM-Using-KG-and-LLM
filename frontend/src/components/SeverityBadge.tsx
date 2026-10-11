import { cn } from "@/lib/utils";

const META: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
};

export default function SeverityBadge({ severity }: { severity: string }) {
  const key = severity?.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
        META[key] ?? "border-border bg-muted text-muted-foreground"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}