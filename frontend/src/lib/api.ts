import axios from "axios";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
export const TOKEN_KEY = "siem-token";

export const api = axios.create({ baseURL: API_URL });

// Attach the JWT (login token) to every request automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token expired or is invalid, clear it and go back to the login page.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginCall = String(error?.config?.url ?? "").includes("/auth/login");
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

/** Turns any error into a short, human-readable message for the UI. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Cannot reach the backend. Is it running on port 8000?";
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  }
  return fallback;
}