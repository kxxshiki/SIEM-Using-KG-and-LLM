import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), loginWithToken: vi.fn() }));

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
  return { ...actual, sendPhoneLoginCode: mocks.send, verifyPhoneLoginCode: mocks.verify };
});

import PhoneLogin from "./PhoneLogin";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/login/phone"]}>
      <Routes>
        <Route path="/login/phone" element={<PhoneLogin />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PhoneLogin page", () => {
  beforeEach(() => {
    mocks.send.mockReset().mockResolvedValue({ message: "If this number can sign in with SMS, a code was sent." });
    mocks.verify.mockReset();
    mocks.loginWithToken.mockReset();
  });

  it("refuses an empty number without calling the backend", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Enter your mobile number.")).toBeInTheDocument();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends the code, then signs in with it", async () => {
    const res = { access_token: "jwt", username: "bob", role: "analyst" };
    mocks.verify.mockResolvedValue(res);
    renderPage();
    await userEvent.type(screen.getByLabelText("Mobile Number"), "98765 43210");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(mocks.send).toHaveBeenCalledWith("+919876543210");
    await userEvent.type(await screen.findByLabelText("6-digit code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith("+919876543210", "123456"));
    expect(mocks.loginWithToken).toHaveBeenCalledWith(res);
    expect(await screen.findByText("home")).toBeInTheDocument();
  });

  it("shows the backend error for a wrong code", async () => {
    mocks.verify.mockRejectedValue(new Error("boom"));
    renderPage();
    await userEvent.type(screen.getByLabelText("Mobile Number"), "98765 43210");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    await userEvent.type(await screen.findByLabelText("6-digit code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.loginWithToken).not.toHaveBeenCalled();
  });
});