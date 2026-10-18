import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterCountries, getAllCountries, type Country, type CountryCode } from "@/lib/countries";

interface Props {
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  /** Called after the user picks a country (used to move focus to the number box). */
  onSelected?: () => void;
  disabled?: boolean;
}

export default function CountrySelect({ value, onChange, onSelected, disabled }: Props) {
  const all = useMemo(() => getAllCountries(), []);
  const selected = all.find((c) => c.code === value) ?? all[0];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const filtered = useMemo(() => filterCountries(all, query), [all, query]);

  const openPanel = () => {
    setQuery("");
    setActive(Math.max(0, all.findIndex((c) => c.code === value)));
    setOpen(true);
  };
  const closePanel = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (c: Country) => {
    onChange(c.code);
    setOpen(false);
    if (onSelected) onSelected();
    else buttonRef.current?.focus();
  };

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Close when the user clicks outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row visible while using the arrow keys.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, query]);

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // do not submit the form
      const c = filtered[active];
      if (c) choose(c);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closePanel(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const activeCountry = filtered[active];

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? closePanel(false) : openPanel())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openPanel();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${selected.name} ${selected.dial}`}
        className="flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true" className="text-base leading-none">{selected.flag}</span>
        <span className="tabular-nums">{selected.dial}</span>
        <ChevronDown size={14} aria-hidden="true" className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-md border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b px-3">
            <Search size={14} aria-hidden="true" className="text-muted-foreground" />
            <input
              ref={searchRef}
              role="combobox"
              aria-label="Search countries"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeCountry ? `${listId}-${activeCountry.code}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              placeholder="Search country or code"
              autoComplete="off"
              className="h-10 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {filtered.length === 0 ? (
            <p role="status" className="px-3 py-4 text-center text-sm text-muted-foreground">
              No country found
            </p>
          ) : (
            <ul ref={listRef} id={listId} role="listbox" aria-label="Countries" className="max-h-60 overflow-y-auto py-1">
              {filtered.map((c, i) => (
                <li
                  key={c.code}
                  id={`${listId}-${c.code}`}
                  role="option"
                  aria-selected={c.code === value}
                  data-active={i === active}
                  onClick={() => choose(c)}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm aria-selected:font-semibold",
                    i === active && "bg-accent"
                  )}
                >
                  <span aria-hidden="true" className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.dial}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}