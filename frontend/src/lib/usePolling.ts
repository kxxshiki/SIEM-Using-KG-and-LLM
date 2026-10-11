import { useEffect, useRef } from "react";

/** Calls `callback` every `intervalMs` milliseconds while `enabled` is true. */
export function usePolling(callback: () => void, intervalMs: number, enabled = true): void {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => saved.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}