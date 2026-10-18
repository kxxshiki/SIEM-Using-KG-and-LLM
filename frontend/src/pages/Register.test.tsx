import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ register: vi.fn() }));

vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggle: vi.fn() }) }));
vi.mock("@/components/auth/ParticleNetworkBackground", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  api: { defaults: { baseURL: "http://test/api/v1" }, get: vi.fn(), post: vi.fn() },
  TOKEN_KEY: "siem_token",
}));
vi.mock("@/lib/authApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authApi")>("@/lib/authApi");
  return { ...actual, registerAccount: mocks.register };
});

import Register from "./Register";

const STRONG = "Str0ng!Passphrase#42";
const RULES_MSG = "Password does not match the password rules.";

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

async function fill(over: Partial<Record<string, string>> = {}) {
  const v = { username: "alice", email: "alice@example.com", phone: "9876543210",
              password: STRONG, confirm: STRONG, ...over };
  await userEvent.type(screen.getByLabelText("Username"), v.username);
  await userEvent.type(screen.getByLabelText("Email address"), v.email);
  await userEvent.type(screen.getByLabelText("Phone number"), v.phone);
  await userEvent.type(screen.getByLabelText("Password"), v.password);
  await userEvent.type(screen.getByLabelText("Confirm password"), v.confirm);
}

describe("Register page", () => {
  beforeEach(() => mocks.register.mockReset());

  it("starts with the default country code and no visible password rules", () => {
    renderRegister();
    expect(screen.getByRole("button", { name: /Country code: India \+91/ })).toBeInTheDocument();
    expect(screen.queryByText("At least 12 characters")).toBeNull();
    expect(screen.queryByText(RULES_MSG)).toBeNull();
  });

  it("shows a rules message with an info button only for a wrong password", async () => {
    renderRegister();
    const pw = screen.getByLabelText("Password");
    await userEvent.type(pw, "weakpass");
    await userEvent.tab(); // leaving the box
    expect(await screen.findByText(RULES_MSG)).toBeInTheDocument();
    expect(screen.queryByText("At least 12 characters")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Show password rules" }));
    expect(screen.getByText("At least 12 characters")).toBeInTheDocument();

    await userEvent.clear(pw);
    await userEvent.type(pw, STRONG);
    expect(screen.queryByText(RULES_MSG)).toBeNull();
    expect(screen.queryByRole("button", { name: "Show password rules" })).toBeNull();
  });

  it("blocks submit when the passwords differ", async () => {
    renderRegister();
    await fill({ confirm: "Different#Pass99xx" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("blocks submit for a weak password", async () => {
    renderRegister();
    await fill({ password: "weakpass", confirm: "weakpass" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(RULES_MSG)).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("blocks submit for a phone number that is too short", async () => {
    renderRegister();
    await fill({ phone: "123" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter a valid phone number for the selected country.")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("registers once, adds the country code itself, then moves to verification", async () => {
    let resolve: (v: unknown) => void = () => undefined;
    mocks.register.mockReturnValue(new Promise((r) => (resolve = r)));
    renderRegister();
    await fill();
    await userEvent.dblClick(screen.getByRole("button", { name: "Create account" }));
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(mocks.register).toHaveBeenCalledWith(
      expect.objectContaining({ username: "alice", email: "alice@example.com", phone: "+919876543210" })
    );
    resolve({ message: "ok", email_sent: true, verification_token: "tok", next_step: "verify_email" });
    expect(await screen.findByText("verify page")).toBeInTheDocument();
  });

  it("shows a backend error and stays on the page", async () => {
    mocks.register.mockRejectedValue(new Error("boom"));
    renderRegister();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByText(/Could not create the account|Something went wrong/)).toBeInTheDocument());
    expect(screen.queryByText("verify page")).toBeNull();
  });
});