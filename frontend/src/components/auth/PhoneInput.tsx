import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/phone";

interface Props {
  id: string;
  label: string;
  iso: string;
  onIsoChange: (iso: string) => void;
  national: string;
  onNationalChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

export default function PhoneInput({
  id, label, iso, onIsoChange, national, onNationalChange, onBlur, error, disabled,
}: Props) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={iso}
          onChange={(e) => onIsoChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-[6.5rem] shrink-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso} title={c.name}>
              {`${c.iso} +${c.dial}`}
            </option>
          ))}
        </select>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => onNationalChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          maxLength={20}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}