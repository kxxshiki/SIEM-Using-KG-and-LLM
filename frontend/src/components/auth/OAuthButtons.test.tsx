import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ options: vi.fn(), assign: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: { defaults: { baseURL: "http://localhost:8000/api/v1" }, get: vi.fn(), post: vi.fn() },
  TOKEN_KEY: "siem_token",
}));
vi.mock("@/lib/authApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authApi")>("@/lib/authApi");
  return { ...actual, getAuthOptions: mocks.options };
});

import OAuthButtons from "./OAuthButtons";

function renderButtons() {
  return render(
    <MemoryRouter>
      <OAuthButtons />
    </MemoryRouter>
  );
}

describe("OAuthButtons", () => {
  beforeEach(() => {
    mocks.options.mockReset();
    mocks.assign.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, origin: "http://localhost:5173", assign: mocks.assign },
    });
  });

  it("always shows Google, GitHub and mobile number", () => {
    renderButtons();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue with mobile number" })).toHaveAttribute("href", "/login/phone");
  });

  it("redirects the browser to the backend start URL when the provider is configured", async () => {
    mocks.options.mockResolvedValue({ google: true, github: true, phone_login: false });
    renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith("http://localhost:8000/api/v1/auth/oauth/google/start")
    );
  });

  it("uses the GitHub start URL for GitHub", async () => {
    mocks.options.mockResolvedValue({ google: true, github: true, phone_login: false });
    renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith("http://localhost:8000/api/v1/auth/oauth/github/start")
    );
  });

  it("explains when the server has no keys for the provider and does not redirect", async () => {
    mocks.options.mockResolvedValue({ google: false, github: true, phone_login: false });
    renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not configured/i);
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("shows an error when the backend cannot be reached", async () => {
    mocks.options.mockRejectedValue(new Error("network"));
    renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});