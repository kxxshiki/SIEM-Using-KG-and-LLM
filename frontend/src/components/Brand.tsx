import { cn } from "@/lib/utils";

export default function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight", className)}>
      Sentinel
      <span className="bg-gradient-to-r from-primary to-brand-purple bg-clip-text text-transparent">SIEM</span>
    </span>
  );
}