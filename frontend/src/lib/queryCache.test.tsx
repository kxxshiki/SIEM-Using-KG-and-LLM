import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearQueryCache, useCachedQuery } from "./queryCache";

describe("useCachedQuery", () => {
  beforeEach(() => clearQueryCache());

  it("returns cached data instantly on the next visit, then refreshes it", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const a = renderHook(() => useCachedQuery("k", fetcher));
    expect(a.result.current.data).toBeUndefined();
    await waitFor(() => expect(a.result.current.data).toBe("first"));
    a.unmount();

    const b = renderHook(() => useCachedQuery("k", fetcher));
    expect(b.result.current.data).toBe("first"); // instant, from the cache
    await waitFor(() => expect(b.result.current.data).toBe("second"));
  });

  it("forgets everything after clearQueryCache", async () => {
    const fetcher = vi.fn().mockResolvedValue("value");
    const a = renderHook(() => useCachedQuery("k", fetcher));
    await waitFor(() => expect(a.result.current.data).toBe("value"));
    a.unmount();
    clearQueryCache();
    const b = renderHook(() => useCachedQuery("k", fetcher));
    expect(b.result.current.data).toBeUndefined();
  });

  it("keeps the old data visible when a refresh fails", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("ok").mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useCachedQuery("k", fetcher));
    await waitFor(() => expect(result.current.data).toBe("ok"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.data).toBe("ok");
    expect(result.current.error).toBeTruthy();
  });
});