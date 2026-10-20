import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggle: vi.fn() }) }));
vi.mock("@/components/auth/ParticleNetworkBackground", () => ({
  default: ({ animate }: { animate?: boolean }) => <div data-testid="bg" data-animate={String(animate)} />,
}));

import AuthShell from "./AuthShell";

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduce && q.includes("reduce"), media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

describe("AuthShell motion control", () => {
  beforeEach(() => localStorage.clear());

  it("animates by default", () => {
    setReducedMotion(false);
    render(<AuthShell title="t">x</AuthShell>);
    expect(screen.getByTestId("bg")).toHaveAttribute("data-animate", "true");
    expect(screen.getByRole("button", { name: /pause background motion/i })).toBeInTheDocument();
  });

  it("starts paused when the system asks for reduced motion, and the user can switch it on", async () => {
    setReducedMotion(true);
    render(<AuthShell title="t">x</AuthShell>);
    expect(screen.getByTestId("bg")).toHaveAttribute("data-animate", "false");
    await userEvent.click(screen.getByRole("button", { name: /play background motion/i }));
    expect(screen.getByTestId("bg")).toHaveAttribute("data-animate", "true");
    expect(localStorage.getItem("siem-motion")).toBe("on");
  });

  it("remembers a pause", async () => {
    setReducedMotion(false);
    const { unmount } = render(<AuthShell title="t">x</AuthShell>);
    await userEvent.click(screen.getByRole("button", { name: /pause background motion/i }));
    unmount();
    render(<AuthShell title="t">x</AuthShell>);
    expect(screen.getByTestId("bg")).toHaveAttribute("data-animate", "false");
  });
});