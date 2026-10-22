let started = false;

export function prefetchApp(): void {
  if (started) return;
  started = true;
  // Start the dashboard chunk while the user enters credentials so the route
  // is ready as soon as the login request completes.
  void import("@/pages/Dashboard");
  const load = () => {
    void import("@/pages/Alerts");
    void import("@/pages/UploadLogs");
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 2000 });
  else window.setTimeout(load, 500);
}
