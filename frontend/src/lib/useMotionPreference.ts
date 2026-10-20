import { useCallback, useEffect, useState } from "react";

const KEY = "siem-motion";
type Choice = "on" | "off" | null;

function readChoice(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

function osReduces(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Decides whether background motion runs.
 * No saved choice: follow the system "reduce motion" setting.
 * A saved choice (from the Pause/Play button) always wins.
 */
export function useMotionPreference() {
  const [choice, setChoice] = useState<Choice>(readChoice);
  const [osReduced, setOsReduced] = useState<boolean>(osReduces);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setOsReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const animate = choice === null ? !osReduced : choice === "on";

  const toggle = useCallback(() => {
    const next: Choice = animate ? "off" : "on";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: the choice lasts until the page is closed */
    }
    setChoice(next);
  }, [animate]);

  return { animate, toggle, osReduced };
}