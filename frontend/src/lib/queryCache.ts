import { useCallback, useEffect, useRef, useState } from "react";

const store = new Map<string, unknown>();

/** Called on sign-in, sign-out and after an upload, so no stale page data survives. */
export function clearQueryCache(): void {
  store.clear();
}

interface Options {
  pollMs?: number;
}

export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>, options: Options = {}) {
  const { pollMs = 0 } = options;
  const [data, setData] = useState<T | undefined>(() => store.get(key) as T | undefined);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(key);
  fetcherRef.current = fetcher;
  keyRef.current = key;

  const refresh = useCallback(async () => {
    const requestKey = keyRef.current;
    try {
      const value = await fetcherRef.current();
      store.set(requestKey, value);
      if (keyRef.current === requestKey) {
        setData(value);
        setError(null);
      }
    } catch (err) {
      if (keyRef.current === requestKey) setError(err); // old data stays visible
    }
  }, []);

  const mutate = useCallback((update: (prev: T | undefined) => T | undefined) => {
    setData((prev) => {
      const next = update(prev);
      if (next !== undefined) store.set(keyRef.current, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const cached = store.get(key);
    if (cached !== undefined) setData(cached as T);
    void refresh();
    if (!pollMs) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [key, pollMs, refresh]);

  return { data, error, refresh, mutate };
}