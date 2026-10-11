import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins Tailwind class names safely (later classes win over earlier ones). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * The backend sends timestamps in UTC without a "Z" suffix
 * (e.g. "2026-10-10T09:01:12"). Browsers would wrongly read that as LOCAL
 * time, so we add the "Z" ourselves before converting to the viewer's timezone.
 */
export function parseServerDate(value: string): Date {
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = parseServerDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}