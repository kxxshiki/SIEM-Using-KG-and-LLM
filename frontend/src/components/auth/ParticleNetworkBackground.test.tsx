import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggle: vi.fn() }) }));

import ParticleNetworkBackground from "./ParticleNetworkBackground";

function makeCtx() {
  return {
    setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    lineWidth: 1, strokeStyle: "", fillStyle: "", shadowColor: "", shadowBlur: 0,
  };
}

function mockMotion(reduce: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduce && q.includes("reduce"), media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

describe("ParticleNetworkBackground", () => {
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    ctx = makeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it("is decorative: hidden from screen readers and ignores pointer events", () => {
    mockMotion(false);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { container } = render(<ParticleNetworkBackground />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas?.className).toContain("pointer-events-none");
  });

  it("animates, and cancels the animation loop on unmount", () => {
    mockMotion(false);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { unmount } = render(<ParticleNetworkBackground />);
    expect(raf).toHaveBeenCalled();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("draws one still frame and never animates when reduced motion is requested", () => {
    mockMotion(true);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    render(<ParticleNetworkBackground />);
    expect(raf).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
  });
});