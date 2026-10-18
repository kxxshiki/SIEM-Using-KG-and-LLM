import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type { CountryCode };

/** Country preselected in the phone field. Change it here. */
export const DEFAULT_COUNTRY: CountryCode = "IN";

export interface Country {
  code: CountryCode;
  name: string;
  dial: string; // for example "+91"
  flag: string; // emoji flag
}

function flagEmoji(code: string): string {
  // 0x1F1A5 + "A".charCodeAt(0) = regional indicator letter A
  return String.fromCodePoint(
    ...Array.from(code.toUpperCase(), (ch) => 0x1f1a5 + ch.charCodeAt(0))
  );
}

let cache: Country[] | null = null;

export function getAllCountries(): Country[] {
  if (cache) return cache;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    names = null; // very old browser: fall back to the ISO code as the name
  }
  cache = getCountries()
    .map((code) => ({
      code,
      name: names?.of(code) ?? code,
      dial: `+${getCountryCallingCode(code)}`,
      flag: flagEmoji(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

/** Search by name, ISO code, or dial code (with or without "+"). */
export function filterCountries(list: Country[], query: string): Country[] {
  const q = query.trim().toLowerCase().replace(/^\+/, "");
  if (!q) return list;
  if (/^\d+$/.test(q)) return list.filter((c) => c.dial.slice(1).startsWith(q));
  return list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
}

export function parseNational(country: CountryCode, national: string) {
  if (!national) return undefined;
  return parsePhoneNumberFromString(national, country);
}

/** Returns "+919876543210" style text, or null if the number is not valid for that country. */
export function toE164(country: CountryCode, national: string): string | null {
  const parsed = parseNational(country, national);
  return parsed && parsed.isValid() ? parsed.number : null;
}