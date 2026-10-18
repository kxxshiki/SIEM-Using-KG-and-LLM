import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, TOKEN_KEY } from "@/lib/api";
import type { LoginResponse, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, if a token is saved, ask the backend who we are.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get<User>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // The backend login expects form fields (not JSON): username + password.
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    const res = await api.post<LoginResponse>("/auth/login", body);

    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    setUser({
      username: res.data.username,
      role: res.data.role,
    });
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    localStorage.removeItem(TOKEN_KEY);
    setUser(null);

    if (token) {
      // Best effort: send the token explicitly after removing it from storage.
      api
        .post("/auth/logout", null, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => undefined);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return ctx;
}
