export interface Country {
  iso: string;
  dial: string;
  name: string;
}

export const COUNTRIES: Country[] = [
  { iso: "IN", dial: "91", name: "India" },
  { iso: "US", dial: "1", name: "United States" },
  { iso: "GB", dial: "44", name: "United Kingdom" },
  { iso: "CA", dial: "1", name: "Canada" },
  { iso: "AU", dial: "61", name: "Australia" },
  { iso: "AE", dial: "971", name: "United Arab Emirates" },
  { iso: "SA", dial: "966", name: "Saudi Arabia" },
  { iso: "SG", dial: "65", name: "Singapore" },
  { iso: "DE", dial: "49", name: "Germany" },
  { iso: "FR", dial: "33", name: "France" },
  { iso: "NL", dial: "31", name: "Netherlands" },
  { iso: "IT", dial: "39", name: "Italy" },
  { iso: "ES", dial: "34", name: "Spain" },
  { iso: "PT", dial: "351", name: "Portugal" },
  { iso: "IE", dial: "353", name: "Ireland" },
  { iso: "CH", dial: "41", name: "Switzerland" },
  { iso: "AT", dial: "43", name: "Austria" },
  { iso: "BE", dial: "32", name: "Belgium" },
  { iso: "SE", dial: "46", name: "Sweden" },
  { iso: "NO", dial: "47", name: "Norway" },
  { iso: "DK", dial: "45", name: "Denmark" },
  { iso: "FI", dial: "358", name: "Finland" },
  { iso: "PL", dial: "48", name: "Poland" },
  { iso: "UA", dial: "380", name: "Ukraine" },
  { iso: "TR", dial: "90", name: "Turkey" },
  { iso: "RU", dial: "7", name: "Russia" },
  { iso: "IL", dial: "972", name: "Israel" },
  { iso: "QA", dial: "974", name: "Qatar" },
  { iso: "KW", dial: "965", name: "Kuwait" },
  { iso: "OM", dial: "968", name: "Oman" },
  { iso: "BH", dial: "973", name: "Bahrain" },
  { iso: "EG", dial: "20", name: "Egypt" },
  { iso: "ZA", dial: "27", name: "South Africa" },
  { iso: "NG", dial: "234", name: "Nigeria" },
  { iso: "KE", dial: "254", name: "Kenya" },
  { iso: "PK", dial: "92", name: "Pakistan" },
  { iso: "BD", dial: "880", name: "Bangladesh" },
  { iso: "LK", dial: "94", name: "Sri Lanka" },
  { iso: "NP", dial: "977", name: "Nepal" },
  { iso: "MY", dial: "60", name: "Malaysia" },
  { iso: "ID", dial: "62", name: "Indonesia" },
  { iso: "TH", dial: "66", name: "Thailand" },
  { iso: "PH", dial: "63", name: "Philippines" },
  { iso: "VN", dial: "84", name: "Vietnam" },
  { iso: "HK", dial: "852", name: "Hong Kong" },
  { iso: "CN", dial: "86", name: "China" },
  { iso: "JP", dial: "81", name: "Japan" },
  { iso: "KR", dial: "82", name: "South Korea" },
  { iso: "NZ", dial: "64", name: "New Zealand" },
  { iso: "BR", dial: "55", name: "Brazil" },
  { iso: "MX", dial: "52", name: "Mexico" },
];

export const DEFAULT_ISO = "IN";

export function dialFor(iso: string): string {
  return COUNTRIES.find((c) => c.iso === iso)?.dial ?? "91";
}

/** Builds +<country code><number>. A leading 0 (national trunk prefix) is dropped, except for Italy. */
export function buildE164(iso: string, national: string): string {
  const dial = dialFor(iso);
  const digits = national.replace(/\D/g, "");
  const trimmed = dial === "39" ? digits : digits.replace(/^0+/, "");
  return `+${dial}${trimmed}`;
}

export function isPlausibleNational(national: string): boolean {
  const n = national.replace(/\D/g, "").length;
  return n >= 6 && n <= 14;
}