import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), loginWithToken: vi.fn() }));

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggle: vi.fn() }) }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ loginWithToken: mocks.loginWithToken, user: null, loading: false, login: vi.fn(), logout: vi.fn() }),
}));
vi.mock("@/components/auth/ParticleNetworkBackground", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  api: { defaults: { baseURL: "http://test/api/v1" }, get: vi.fn(), post: vi.fn() },
  TOKEN_KEY: "siem_token",
}));
vi.mock("@/lib/authApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authApi")>("@/lib/authApi");
  return { ...actual, exchangeOAuthCode: mocks.exchange };
});

import OAuthCallback from "./OAuthCallback";

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/callback${search}`]}>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OAuthCallback page", () => {
  beforeEach(() => {
    mocks.exchange.mockReset();
    mocks.loginWithToken.mockReset();
  });

  it("swaps the one-time code for a session and goes to the dashboard", async () => {
    const res = { access_token: "jwt", username: "bob", role: "analyst" };
    mocks.exchange.mockResolvedValue(res);
    renderAt("?code=one-time-code");
    expect(await screen.findByText("home")).toBeInTheDocument();
    expect(mocks.exchange).toHaveBeenCalledWith("one-time-code");
    expect(mocks.loginWithToken).toHaveBeenCalledWith(res);
  });

  it("explains that approval is pending and does not call the backend", async () => {
    renderAt("?status=awaiting_approval");
    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("shows a readable message for an error code", async () => {
    renderAt("?error=account_exists");
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("shows an error when the exchange fails", async () => {
    mocks.exchange.mockRejectedValue(new Error("boom"));
    renderAt("?code=expired-code");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(mocks.loginWithToken).not.toHaveBeenCalled();
  });
});