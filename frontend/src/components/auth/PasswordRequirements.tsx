import { Check, Circle } from "lucide-react";
import { evaluatePassword } from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  password: string;
  username?: string;
}

export default function PasswordRequirements({ id, password, username }: Props) {
  const { results } = evaluatePassword(password, username);
  return (
    <ul id={id} aria-label="Password requirements" className="space-y-1 text-xs">
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
  );
}