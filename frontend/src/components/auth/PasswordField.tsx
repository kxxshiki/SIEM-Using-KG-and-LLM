
import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  onBlur?: () => void;
  error?: string;
  describedBy?: string;
  disabled?: boolean;
  placeholder?: string;
  labelAction?: ReactNode;
  errorAction?: ReactNode;
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  onBlur,
  error,
  describedBy,
  disabled,
  placeholder,
  labelAction,
  errorAction,
}: Props) {
  const [visible, setVisible] = useState(false);

  const errorId = `${id}-error`;
  const described =
    [error ? errorId : "", describedBy ?? ""]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>

      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          maxLength={128}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className="pr-10"
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {visible ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
        </button>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {errorAction && <div className="mt-2">{errorAction}</div>}
    </div>
  );
}
