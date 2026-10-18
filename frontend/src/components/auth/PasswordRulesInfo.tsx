import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import PasswordRequirements from "@/components/auth/PasswordRequirements";

interface Props {
  id: string;
  password: string;
  username?: string;
}

/**
 * Small (i) button. Clicking it opens the password checklist.
 * Must be placed inside a `relative` parent (PasswordField is one): the box
 * opens under the field, at the full width of the field.
 */
export default function PasswordRulesInfo({ id, password, username }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Show password rules"
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="absolute inset-x-0 top-full z-30 mt-1 rounded-md border bg-card p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold">Your password must have:</p>
          <PasswordRequirements id={`${id}-list`} password={password} username={username} />
        </div>
      )}
    </span>
  );
}