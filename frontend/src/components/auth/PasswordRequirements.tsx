import { useState } from "react";
import { Check, Circle, Info } from "lucide-react";
import { evaluatePassword } from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  password: string;
  username?: string;
  /** Pass `open` and `onOpenChange` to control it from the parent. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export default function PasswordRequirements({
  id, password, username, open, onOpenChange, defaultOpen = false,
}: Props) {
  const [inner, setInner] = useState(defaultOpen);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : inner;
  const setOpen = (value: boolean) => {
    if (!controlled) setInner(value);
    onOpenChange?.(value);
  };

  const { results, allMet } = evaluatePassword(password, username);
  const metCount = results.filter((r) => r.met).length;
  const panelId = `${id}-panel`;

  return (
    <div
      id={id}
      onKeyDown={(e) => {
        if (e.key === "Escape" && isOpen) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`Password requirements, ${metCount} of ${results.length} met`}
        title="Password requirements"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          allMet
            ? "border-green-500/60 text-green-500"
            : "border-primary/50 text-primary hover:bg-primary/10"
        )}
      >
        <Info size={16} aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          id={panelId}
          aria-label="Password requirements"
          className="mt-2 space-y-1.5 rounded-md border bg-card/80 p-3 text-xs"
        >
          {results.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-2",
                r.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}
            >
              {r.met ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              <span>{r.label}</span>
              <span className="sr-only">{r.met ? "(met)" : "(not met)"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}