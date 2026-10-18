import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Verify email", "Verify phone", "Admin approval"];

export default function VerificationSteps({ current }: { current?: 1 | 2 | 3 }) {
  return (
    <ol className="mb-5 flex items-start gap-2 text-[11px]" aria-label="Account activation steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = current !== undefined && n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-start gap-1.5" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                done && "border-green-500 bg-green-500 text-white",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "text-muted-foreground"
              )}
            >
              {done ? <Check size={11} aria-hidden="true" /> : n}
            </span>
            <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}