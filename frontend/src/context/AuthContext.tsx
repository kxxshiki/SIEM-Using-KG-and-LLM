import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { api, TOKEN_KEY } from "@/lib/api";
import { clearQueryCache } from "@/lib/queryCache";
import type { LoginResponse, User } from "@/types";

const USER_KEY = "siem_user"; // username and role only; the server still checks every request

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithToken: (res: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readCachedUser(): User | null {
  try {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: unknown; role?: unknown };
    if (typeof parsed.username === "string" && typeof parsed.role === "string") {
      return { username: parsed.username, role: parsed.role } as User;
    }
  } catch {
    /* ignore a damaged cache */
  }
  return null;
}

function remember(u: { username: string; role: string }): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify({ username: u.username, role: u.role }));
  } catch {
    /* storage unavailable */
  }
}

function forget(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readCachedUser);
  const [loading, setLoading] = useState<boolean>(
    () => localStorage.getItem(TOKEN_KEY) !== null && readCachedUser() === null
  );

  // Verify the saved session in the background. The page does not wait for this.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then((res) => {
        setUser(res.data);
        remember(res.data);
      })
      .catch((err) => {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 401 || status === 403) {
          forget();
          clearQueryCache();
          setUser(null);
        }
        // Network or server error: keep the session and try again on the next request.
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // The backend login expects form fields (not JSON): username + password.
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);
    const res = await api.post<LoginResponse>("/auth/login", body);
    clearQueryCache(); // a fresh sign-in starts with empty pages
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    remember(res.data);
    setUser({ username: res.data.username, role: res.data.role });
  }, []);

  const loginWithToken = useCallback((res: LoginResponse) => {
    clearQueryCache();
    localStorage.setItem(TOKEN_KEY, res.access_token);
    remember(res);
    setUser({ username: res.username, role: res.role });
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    forget();
    clearQueryCache();
    setUser(null);
    if (token) {
      // Best effort. The server invalidates ALL tokens of this user.
      api
        .post("/auth/logout", null, { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => undefined);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginWithToken, logout }),
    [user, loading, login, loginWithToken, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}