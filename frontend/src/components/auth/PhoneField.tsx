import type { ClipboardEvent } from "react";
import CountrySelect from "@/components/auth/CountrySelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseNational, type CountryCode } from "@/lib/countries";
import { parsePhoneNumberFromString } from "libphonenumber-js";

interface Props {
  id: string;
  country: CountryCode;
  national: string; // digits only, without the country code
  onCountryChange: (code: CountryCode) => void;
  onNationalChange: (digits: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

export default function PhoneField({
  id, country, national, onCountryChange, onNationalChange, onBlur, error, disabled,
}: Props) {
  const errorId = `${id}-error`;
  const previewId = `${id}-preview`;
  const parsed = parseNational(country, national);
  const preview = parsed?.isValid() ? parsed.formatInternational() : "";
  const described = [error ? errorId : "", preview ? previewId : ""].filter(Boolean).join(" ") || undefined;

  // Pasting a full international number (+49 ...) selects the country automatically.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").trim();
    if (!text.startsWith("+")) return;
    const p = parsePhoneNumberFromString(text);
    if (p?.country) {
      e.preventDefault();
      onCountryChange(p.country);
      onNationalChange(p.nationalNumber);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Phone number</Label>
      <div className="flex gap-2">
        <CountrySelect
          value={country}
          onChange={onCountryChange}
          onSelected={() => document.getElementById(id)?.focus()}
          disabled={disabled}
        />
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => onNationalChange(e.target.value.replace(/\D/g, "").slice(0, 15))}
          onPaste={onPaste}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
        />
      </div>
      {preview && !error && (
        <p id={previewId} className="text-xs text-muted-foreground">Full number: {preview}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}