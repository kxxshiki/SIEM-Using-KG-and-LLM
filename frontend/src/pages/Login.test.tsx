import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ login: mocks.login, logout: vi.fn(), user: null, loading: false }),
}));
vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggle: vi.fn() }) }));
vi.mock("@/components/auth/ParticleNetworkBackground", () => ({ default: () => null }));
vi.mock("@/components/auth/OAuthButtons", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  api: { defaults: { baseURL: "http://test/api/v1" }, get: vi.fn(), post: vi.fn() },
  TOKEN_KEY: "siem_token",
}));

import Login from "./Login";
import { hasVerificationToken, setVerificationToken } from "@/lib/authApi";

function axiosError(status: number, data: unknown) {
  return new AxiosError("fail", "ERR_BAD_REQUEST", undefined, undefined, {
    status, data, headers: {}, statusText: "", config: {},
  } as never);
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<p>verify page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Login page", () => {
  beforeEach(() => {
    mocks.login.mockReset();
    setVerificationToken(null);
  });

  it("starts empty: hint text only, no values and no demo credentials", () => {
    renderLogin();
    const user = screen.getByLabelText("Username");
    const pass = screen.getByLabelText("Password");
    expect(user).toHaveValue("");
    expect(pass).toHaveValue("");
    expect(user).toHaveAttribute("placeholder", "Your username");
    expect(pass).toHaveAttribute("placeholder", "Password");
    expect(screen.queryByText(/admin123|analyst123|dev accounts/i)).toBeNull();
  });

  it("shows the SentinelSIEM name and the Create an account link", () => {
    renderLogin();
    expect(screen.getAllByText(/sentinelsiem/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Create an account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot Password?" })).toBeInTheDocument();
  });

  it("shows validation errors and does not call the backend when empty", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your username.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("sends the trimmed username and the password", async () => {
    mocks.login.mockResolvedValue(undefined);
    renderLogin();
    await userEvent.type(screen.getByLabelText("Username"), "  alice  ");
    await userEvent.type(screen.getByLabelText("Password"), "secret-value");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith("alice", "secret-value"));
  });

  it("shows a generic message for a 401", async () => {
    mocks.login.mockRejectedValue(axiosError(401, { detail: "Incorrect username or password" }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect username or password.");
  });

  it("sends a pending account to verification and keeps the token in memory only", async () => {
    mocks.login.mockRejectedValue(
      axiosError(403, { detail: { code: "verification_required", message: "x", verification_token: "tok-123" } })
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("verify page")).toBeInTheDocument();
    expect(hasVerificationToken()).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it("shows the server message when approval is pending", async () => {
    mocks.login.mockRejectedValue(
      axiosError(403, { detail: { code: "approval_required", message: "Waiting for administrator approval." } })
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Waiting for administrator approval.");
  });
});