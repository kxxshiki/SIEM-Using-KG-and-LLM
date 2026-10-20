import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ register: vi.fn(), sendCode: vi.fn(), verifyCode: vi.fn() }));

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggle: vi.fn() }) }));
vi.mock("@/components/auth/ParticleNetworkBackground", () => ({ default: () => null }));
vi.mock("@/components/auth/OAuthButtons", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  api: { defaults: { baseURL: "http://test/api/v1" }, get: vi.fn(), post: vi.fn() },
  TOKEN_KEY: "siem_token",
}));
vi.mock("@/lib/authApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authApi")>("@/lib/authApi");
  return {
    ...actual,
    registerAccount: mocks.register,
    sendSignupEmailCode: mocks.sendCode,
    verifySignupEmailCode: mocks.verifyCode,
  };
});

import Register from "./Register";

const STRONG = "Str0ng!Passphrase#42";

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<p>verify page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function verifyEmail() {
  await userEvent.type(screen.getByLabelText("Email address"), "alice@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Send code" }));
  await userEvent.type(await screen.findByLabelText("6-digit code"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "Verify" }));
  await screen.findByText("Email verified");
}

async function fillRest(confirm = STRONG) {
  await userEvent.type(screen.getByLabelText("Mobile Number"), "98765 43210");
  await userEvent.type(screen.getByLabelText("Username"), "alice");
  await userEvent.type(screen.getByLabelText("Password"), STRONG);
  await userEvent.type(screen.getByLabelText("Confirm Password"), confirm);
}

describe("Register page", () => {
  beforeEach(() => {
    mocks.register.mockReset();
    mocks.sendCode.mockReset().mockResolvedValue({ message: "ok" });
    mocks.verifyCode.mockReset().mockResolvedValue({ email_proof: "proof-1", expires_in: 1800 });
  });

  it("starts empty with hint text only", () => {
    renderRegister();
    expect(screen.getByLabelText("Email address")).toHaveValue("");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("placeholder", "you@example.com");
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Mobile Number")).toHaveValue("");
    expect(screen.getByLabelText("Country code")).toHaveValue("IN");
  });

  it("updates the password checklist while typing", async () => {
    renderRegister();
    const item = () => screen.getByText("At least 12 characters").closest("li");
    expect(item()).toHaveTextContent("(not met)");
    await userEvent.type(screen.getByLabelText("Password"), STRONG);
    expect(item()).toHaveTextContent("(met)");
  });

  it("refuses to create the account until the email is verified", async () => {
    renderRegister();
    await fillRest();
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Verify your email first.")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("sends the code, verifies it, then registers with the proof and an E.164 number", async () => {
    mocks.register.mockResolvedValue({ message: "ok", verification_token: "tok", next_step: "verify_phone" });
    renderRegister();
    await verifyEmail();
    expect(mocks.sendCode).toHaveBeenCalledWith("alice@example.com");
    expect(mocks.verifyCode).toHaveBeenCalledWith("alice@example.com", "123456");
    await fillRest();
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await waitFor(() =>
      expect(mocks.register).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "alice",
          email: "alice@example.com",
          phone: "+919876543210",
          email_proof: "proof-1",
        })
      )
    );
    expect(await screen.findByText("verify page")).toBeInTheDocument();
  });

  it("blocks submit when the passwords differ", async () => {
    renderRegister();
    await verifyEmail();
    await fillRest("Different#Pass99xx");
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("registers once, even on a double click", async () => {
    let resolve: (v: unknown) => void = () => undefined;
    mocks.register.mockReturnValue(new Promise((r) => (resolve = r)));
    renderRegister();
    await verifyEmail();
    await fillRest();
    await userEvent.dblClick(screen.getByRole("button", { name: "Create Account" }));
    expect(mocks.register).toHaveBeenCalledTimes(1);
    resolve({ message: "ok", verification_token: "tok", next_step: "verify_phone" });
    expect(await screen.findByText("verify page")).toBeInTheDocument();
  });

  it("shows a backend error for the code and stays on the page", async () => {
    mocks.verifyCode.mockRejectedValue(new Error("boom"));
    renderRegister();
    await userEvent.type(screen.getByLabelText("Email address"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    await userEvent.type(await screen.findByLabelText("6-digit code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Email verified")).toBeNull();
  });
});