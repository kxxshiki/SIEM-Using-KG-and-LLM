import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  danger?: boolean;
}

export default function StatCard({ title, value, icon: Icon, hint, danger }: StatCardProps) {
  return (
    <div className="gradient-border rounded-xl bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={cn("mt-2 text-3xl font-bold tracking-tight", danger && "text-red-500")}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            danger ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
          )}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}