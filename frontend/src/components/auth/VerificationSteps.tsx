
import { useState } from "react";
import { CheckCircle2, Mail, Phone, LoaderCircle } from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

interface VerificationStepsProps {
  verificationToken?: string;
  /** Compact progress indicator used by the current verification page. */
  current?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  onComplete?: () => void;
}

type VerificationStatus = {
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  next_step: string;
  email_masked?: string;
  phone_masked?: string;
};

export default function VerificationSteps({
  verificationToken = "",
  current,
  emailVerified = false,
  phoneVerified = false,
  onComplete,
}: VerificationStepsProps) {
  const [emailDone, setEmailDone] = useState(emailVerified);
  const [phoneDone, setPhoneDone] = useState(phoneVerified);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<VerificationStatus | null>(null);

  if (current !== undefined) {
    const steps = ["Verify email", "Verify phone", "Account review"];
    return (
      <ol aria-label="Account verification steps" className="mb-5 grid grid-cols-3 gap-2">
        {steps.map((label, index) => {
          const number = index + 1;
          const complete = number < current;
          const active = number === current;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-2 text-xs">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${complete || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{complete ? "✓" : number}</span>
              <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  async function apiRequest<T>(
    path: string,
    method: "GET" | "POST",
    body?: object,
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/auth/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${verificationToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = data?.detail;
      const errorMessage =
        typeof detail === "string"
          ? detail
          : detail?.message || "Request failed. Please try again.";

      throw new Error(errorMessage);
    }

    return data as T;
  }

  async function run(
    action: () => Promise<void>,
  ): Promise<boolean> {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await action();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    const result = await apiRequest<VerificationStatus>(
      "verification-status",
      "GET",
    );

    setStatus(result);
    setEmailDone(result.email_verified);
    setPhoneDone(result.phone_verified);

    if (result.status === "active") {
      onComplete?.();
    }
  }

  async function sendEmailCode() {
    const ok = await run(async () => {
      await apiRequest("resend-email", "POST");
      setEmailSent(true);
      setMessage("Verification email sent. Check your inbox.");
    });

    if (ok) {
      // Keep the success message visible until the next action.
    }
  }

  async function verifyEmailCode() {
    if (!emailCode.trim()) {
      setError("Enter the email verification code.");
      return;
    }

    await run(async () => {
      await apiRequest("verify-email-otp", "POST", {
        code: emailCode.trim(),
      });

      setEmailDone(true);
      setMessage("Email verified successfully. Continue with your phone.");
      await refreshStatus();
    });
  }

  async function sendPhoneCode() {
    await run(async () => {
      await apiRequest("send-phone-otp", "POST");
      setPhoneSent(true);
      setMessage("SMS verification code requested.");
    });
  }

  async function verifyPhoneCode() {
    if (!phoneCode.trim()) {
      setError("Enter the SMS verification code.");
      return;
    }

    await run(async () => {
      await apiRequest("verify-phone-otp", "POST", {
        code: phoneCode.trim(),
      });

      setPhoneDone(true);
      setMessage("Phone verified successfully.");
      await refreshStatus();
    });
  }

  const allVerified = emailDone && phoneDone;

  return (
    <section className="mx-auto w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <header>
        <h2 className="text-2xl font-semibold">
          Verify your account
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Verify your email and phone number to continue.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-3">
          <Mail className="mb-2 h-5 w-5" />
          <p className="font-medium">Email</p>
          <p className="text-sm text-muted-foreground">
            {emailDone ? "Verified" : "Not verified"}
          </p>
        </div>

        <div className="rounded-xl border border-border p-3">
          <Phone className="mb-2 h-5 w-5" />
          <p className="font-medium">Phone</p>
          <p className="text-sm text-muted-foreground">
            {phoneDone ? "Verified" : "Not verified"}
          </p>
        </div>
      </div>

      {allVerified ? (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h3 className="text-lg font-semibold">
            Verification complete
          </h3>
          <p className="text-sm text-muted-foreground">
            {status?.status === "awaiting_approval"
              ? "Your account is waiting for administrator approval."
              : status?.status === "active"
                ? "Your account is active."
                : "Your verification is complete. Your account status is being checked."}
          </p>
          {status?.status === "active" && (
            <button
              type="button"
              onClick={onComplete}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-primary-foreground"
            >
              Continue
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {!emailDone && (
            <div className="space-y-3">
              <h3 className="font-semibold">Step 1: Verify email</h3>

              <button
                type="button"
                onClick={sendEmailCode}
                disabled={loading}
                className="w-full rounded-lg border border-border px-4 py-2.5 disabled:opacity-50"
              >
                {loading
                  ? "Please wait..."
                  : emailSent
                    ? "Resend email code"
                    : "Send email verification code"}
              </button>

              {emailSent && (
                <>
                  <input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="Enter email code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={10}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5"
                  />

                  <button
                    type="button"
                    onClick={verifyEmailCode}
                    disabled={loading}
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-primary-foreground disabled:opacity-50"
                  >
                    {loading ? (
                      <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                    ) : (
                      "Verify email"
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {!phoneDone && (
            <div className="space-y-3">
              <h3 className="font-semibold">Step 2: Verify phone</h3>

              {!emailDone ? (
                <p className="text-sm text-muted-foreground">
                  Verify your email before requesting an SMS code.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={sendPhoneCode}
                    disabled={loading}
                    className="w-full rounded-lg border border-border px-4 py-2.5 disabled:opacity-50"
                  >
                    {loading
                      ? "Please wait..."
                      : phoneSent
                        ? "Resend SMS code"
                        : "Send SMS verification code"}
                  </button>

                  {phoneSent && (
                    <>
                      <input
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        placeholder="Enter SMS code"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={10}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5"
                      />

                      <button
                        type="button"
                        onClick={verifyPhoneCode}
                        disabled={loading}
                        className="w-full rounded-lg bg-primary px-4 py-2.5 text-primary-foreground disabled:opacity-50"
                      >
                        {loading ? (
                          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                        ) : (
                          "Verify phone"
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
