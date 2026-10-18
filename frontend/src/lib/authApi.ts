import axios, { AxiosError } from "axios";
import { api } from "@/lib/api";

export type NextStep = "verify_email" | "verify_phone" | "awaiting_approval" | "done";

export interface RegisterInput {
  username: string;
  full_name?: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
}
export interface RegisterResult {
  message: string;
  email_sent: boolean;
  verification_token: string;
  next_step: NextStep;
}
export interface VerificationStatus {
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  email_masked: string;
  phone_masked: string;
  next_step: NextStep;
}
export interface VerifyResult {
  verified: boolean;
  next_step: NextStep;
  message: string;
}
export interface MessageResult {
  message: string;
}
export interface PendingUser {
  id: number;
  username: string;
  full_name: string | null;
  email: string;
  phone_e164: string | null;
  created_at: string | null;
}

/**
 * Separate axios client for the public auth pages. It reuses the base URL of the
 * main client but not its interceptors, so a wrong code or an expired verification
 * token can never trigger the app-wide "session expired" handling.
 */
const client = axios.create({
  baseURL: api.defaults.baseURL ?? "/api/v1",
  timeout: 15000,
});

/**
 * Short-lived, low-privilege token used only for the verification steps.
 * Kept in memory only (never in browser storage). A page refresh loses it;
 * signing in again returns a new one while the account is still pending.
 */
let verificationToken: string | null = null;
export function setVerificationToken(token: string | null): void {
  verificationToken = token;
}
export function hasVerificationToken(): boolean {
  return verificationToken !== null;
}
function verificationHeaders(): Record<string, string> {
  return verificationToken ? { Authorization: `Bearer ${verificationToken}` } : {};
}

// ---------- errors ----------
export interface ApiProblem {
  status: number; // 0 = no response from server
  code?: string;
  message: string;
  retryAfter?: number;
  detail?: Record<string, unknown>;
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function toProblem(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): ApiProblem {
  if (!axios.isAxiosError(err)) return { status: 0, message: fallback };
  const e = err as AxiosError<{ detail?: unknown }>;

  if (!e.response) {
    return {
      status: 0,
      code: "network",
      message:
        e.code === "ECONNABORTED"
          ? "The server took too long to respond. Please try again."
          : "Cannot reach the server. Check your connection and try again.",
    };
  }

  const status = e.response.status;
  const header = Number(e.response.headers?.["retry-after"]);
  const retryAfter = Number.isFinite(header) && header > 0 ? header : undefined;
  const detail = e.response.data?.detail;

  let message = fallback;
  let code: string | undefined;
  let extra: Record<string, unknown> | undefined;

  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    const parts = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg).replace(/^Value error,\s*/i, "")
          : ""
      )
      .filter(Boolean);
    if (parts.length) message = parts.join(". ");
  } else if (detail && typeof detail === "object") {
    extra = detail as Record<string, unknown>;
    if (typeof extra.code === "string") code = extra.code;
    if (typeof extra.message === "string") message = extra.message;
  }

  if (status === 429) {
    message = `Too many attempts. ${
      retryAfter ? `Try again in ${formatWait(retryAfter)}.` : "Try again later."
    }`;
  } else if (status >= 500 && status !== 503) {
    message = "The server had a problem. Please try again later.";
  }

  return { status, code, message, retryAfter, detail: extra };
}

// ---------- registration and verification ----------
export async function registerAccount(input: RegisterInput): Promise<RegisterResult> {
  const res = await client.post<RegisterResult>("/auth/register", input);
  return res.data;
}

export async function getVerificationStatus(): Promise<VerificationStatus> {
  const res = await client.get<VerificationStatus>("/auth/verification-status", {
    headers: verificationHeaders(),
  });
  return res.data;
}

export async function verifyEmailOtp(code: string): Promise<VerifyResult> {
  const res = await client.post<VerifyResult>(
    "/auth/verify-email-otp",
    { code },
    { headers: verificationHeaders() }
  );
  return res.data;
}

export async function verifyEmailLink(token: string): Promise<VerifyResult> {
  const res = await client.post<VerifyResult>("/auth/verify-email-link", { token });
  return res.data;
}

export async function resendEmail(): Promise<MessageResult> {
  const res = await client.post<MessageResult>("/auth/resend-email", null, {
    headers: verificationHeaders(),
  });
  return res.data;
}

export async function sendPhoneOtp(): Promise<MessageResult> {
  const res = await client.post<MessageResult>("/auth/send-phone-otp", null, {
    headers: verificationHeaders(),
  });
  return res.data;
}

export async function verifyPhoneOtp(code: string): Promise<VerifyResult> {
  const res = await client.post<VerifyResult>(
    "/auth/verify-phone-otp",
    { code },
    { headers: verificationHeaders() }
  );
  return res.data;
}

// ---------- password reset ----------
export async function forgotPassword(email: string): Promise<MessageResult> {
  const res = await client.post<MessageResult>("/auth/forgot-password", { email });
  return res.data;
}

export async function validateResetToken(token: string): Promise<{ valid: boolean }> {
  const res = await client.post<{ valid: boolean }>("/auth/validate-reset-token", { token });
  return res.data;
}

export async function resetPassword(input: {
  token: string;
  new_password: string;
  confirm_password: string;
}): Promise<MessageResult> {
  const res = await client.post<MessageResult>("/auth/reset-password", input);
  return res.data;
}

// ---------- admin approval (uses the normal logged-in client) ----------
export async function listPendingUsers(): Promise<PendingUser[]> {
  const res = await api.get<PendingUser[]>("/auth/admin/pending-users");
  return res.data;
}
export async function approveUser(id: number): Promise<MessageResult> {
  const res = await api.post<MessageResult>(`/auth/admin/users/${id}/approve`);
  return res.data;
}
export async function rejectUser(id: number): Promise<MessageResult> {
  const res = await api.post<MessageResult>(`/auth/admin/users/${id}/reject`);
  return res.data;
}