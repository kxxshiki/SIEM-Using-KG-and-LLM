import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  buttonLabel?: string;
}

export default function CodeEntry({ id, value, onChange, onSubmit, busy, buttonLabel = "Verify" }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor={id}>6-digit code</Label>
        <Input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (value.length === 6 && !busy) onSubmit();
            }
          }}
          disabled={busy}
          className="text-center font-mono text-lg tracking-[0.5em]"
        />
      </div>
      <Button type="button" className="w-full" disabled={busy || value.length !== 6} onClick={onSubmit}>
        {busy ? "Checking…" : buttonLabel}
      </Button>
    </div>
  );
}