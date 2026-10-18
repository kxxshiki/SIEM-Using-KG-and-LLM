import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  state: { user: null as null | { username: string; role: string }, loading: false },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/layout/AppLayout", () => ({
  default: () => (<div><p>app layout</p><Outlet /></div>),
}));

import { PublicOnly, RequireAdmin, RequireAuth } from "./guards";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<PublicOnly><p>login page</p></PublicOnly>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>dashboard</p>} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin/approvals" element={<p>approvals</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("route guards (UI only; the backend enforces the real rules)", () => {
  beforeEach(() => {
    auth.state = { user: null, loading: false };
  });

  it("sends anonymous visitors to /login", () => {
    renderAt("/");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("shows a loading message while the session is being checked", () => {
    auth.state = { user: null, loading: true };
    renderAt("/");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("lets a signed-in user reach protected pages", () => {
    auth.state = { user: { username: "bob", role: "analyst" }, loading: false };
    renderAt("/");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("keeps analysts out of the admin page", () => {
    auth.state = { user: { username: "bob", role: "analyst" }, loading: false };
    renderAt("/admin/approvals");
    expect(screen.queryByText("approvals")).toBeNull();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("lets admins into the admin page", () => {
    auth.state = { user: { username: "root", role: "admin" }, loading: false };
    renderAt("/admin/approvals");
    expect(screen.getByText("approvals")).toBeInTheDocument();
  });

  it("redirects a signed-in user away from /login", () => {
    auth.state = { user: { username: "bob", role: "analyst" }, loading: false };
    renderAt("/login");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
