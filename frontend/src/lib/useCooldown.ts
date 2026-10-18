import { useEffect, useState } from "react";

/** Counts down from N seconds to 0. Used for "Resend" buttons. */
export function useCooldown(): [number, (seconds: number) => void] {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  return [remaining, setRemaining];
}