import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", toggle: vi.fn() }),
}));

import ParticleNetworkBackground from "./ParticleNetworkBackground";

function makeCtx() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
    shadowColor: "",
    shadowBlur: 0,
  };
}

function mockMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as typeof window.matchMedia;
}

describe("ParticleNetworkBackground", () => {
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    ctx = makeCtx();

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is decorative: hidden from screen readers and ignores pointer events", () => {
    mockMotion(false);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    const { container } = render(<ParticleNetworkBackground />);
    const canvas = container.querySelector("canvas");

    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas?.className).toContain("pointer-events-none");
  });

  it("animates and cancels the animation loop on unmount", () => {
    mockMotion(false);

    let frameId = 0;
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => ++frameId);

    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const { unmount } = render(<ParticleNetworkBackground />);

    expect(raf).toHaveBeenCalled();
    const scheduledId = frameId;

    unmount();

    expect(cancel).toHaveBeenCalledWith(scheduledId);
  });

  it("keeps moving (more gently) when the computer asks for reduced motion", () => {
    mockMotion(true);

    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(1);

    render(<ParticleNetworkBackground />);

    expect(raf).toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it("animates anyway when motion is forced on", () => {
    mockMotion(true);

    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(3);

    render(<ParticleNetworkBackground animate />);

    expect(raf).toHaveBeenCalled();
  });

  it("stops the animation loop when animate changes to false", () => {
    mockMotion(false);

    let frameId = 0;
    vi.spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => ++frameId);

    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const { rerender } = render(
      <ParticleNetworkBackground animate />,
    );

    const scheduledId = frameId;
    cancel.mockClear();

    rerender(<ParticleNetworkBackground animate={false} />);

    expect(cancel).toHaveBeenCalledWith(scheduledId);
  });
});