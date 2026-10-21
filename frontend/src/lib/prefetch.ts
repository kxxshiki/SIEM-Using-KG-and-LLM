let started = false;

export function prefetchApp(): void {
  if (started) return;
  started = true;
  const load = () => {
    void import("@/pages/Dashboard");
    void import("@/pages/Alerts");
    void import("@/pages/UploadLogs");
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 2000 });
  else window.setTimeout(load, 500);
}