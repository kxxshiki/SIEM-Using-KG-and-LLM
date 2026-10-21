import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", toggle: vi.fn() }),
}));

vi.mock("@/components/auth/ParticleNetworkBackground", () => ({
  default: () => <div data-testid="bg" />,
}));

import AuthShell from "./AuthShell";

describe("AuthShell", () => {
  beforeEach(() => localStorage.clear());

  it("renders the branding, title, and children", () => {
    render(
      <AuthShell title="Sign in" subtitle="Welcome back">
        Login form
      </AuthShell>,
    );

    expect(screen.getByText("Threat Radar")).toBeInTheDocument();
    expect(screen.getByText("SentinelSIEM")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("Login form")).toBeInTheDocument();
  });

  it("renders the theme toggle", () => {
    render(<AuthShell title="Sign in">Login form</AuthShell>);

    expect(
      screen.getByRole("button", { name: /switch to light mode/i }),
    ).toBeInTheDocument();
  });

  it("does not render a background motion control", () => {
    render(<AuthShell title="Sign in">Login form</AuthShell>);

    expect(
      screen.queryByRole("button", { name: /pause background motion/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /play background motion/i }),
    ).not.toBeInTheDocument();
  });
});
