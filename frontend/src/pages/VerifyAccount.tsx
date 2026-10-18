import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import VerificationSteps from "@/components/auth/VerificationSteps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCooldown } from "@/lib/useCooldown";
import {
  getVerificationStatus, hasVerificationToken, resendEmail, sendPhoneOtp,
  setVerificationToken, toProblem, verifyEmailOtp, verifyPhoneOtp,
  type VerificationStatus,
} from "@/lib/authApi";

type Phase = "loading" | "expired" | "ready" | "error";
const RESEND_SECONDS = 60; // matches the backend default OTP_RESEND_COOLDOWN_SECONDS

function CodeEntry(props: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={props.onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={props.id}>6-digit code</Label>
        <Input
          id={props.id}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={props.busy}
          className="text-center font-mono text-lg tracking-[0.5em]"
        />
      </div>
      <Button type="submit" variant="gradient" className="w-full" disabled={props.busy || props.value.length !== 6}>
        {props.busy ? "Checking…" : "Verify"}
      </Button>
    </form>
  );
}

export default function VerifyAccount() {
  const location = useLocation();
  const signup = location.state as { emailSent?: boolean } | null;

  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [cooldown, setCooldown] = useCooldown();
  const busyRef = useRef(false);
  const started = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getVerificationStatus());
      setPhase("ready");
    } catch (err) {
      const p = toProblem(err);
      if (p.status === 401) {
        setVerificationToken(null);
        setPhase("expired");
      } else {
        setError(p.message);
        setPhase("error");
      }
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!hasVerificationToken()) {
      setPhase("expired");
      return;
    }
    if (signup?.emailSent) setCooldown(RESEND_SECONDS);
    void loadStatus();
  }, [loadStatus, setCooldown, signup]);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await action();
    } catch (err) {
      const p = toProblem(err);
      if (p.status === 401) {
        setVerificationToken(null);
        setPhase("expired");
      } else {
        setError(p.message);
        if (p.status === 429 && p.retryAfter) setCooldown(p.retryAfter);
        if (p.status === 409) await loadStatus(); // state changed elsewhere; re-sync
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onVerifyEmail = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await verifyEmailOtp(code);
      setCode("");
      setInfo(r.message);
      await loadStatus();
    });
  };
  const onResendEmail = () =>
    void run(async () => {
      const r = await resendEmail();
      setInfo(r.message);
      setCooldown(RESEND_SECONDS);
    });
  const onSendPhone = () =>
    void run(async () => {
      await sendPhoneOtp();
      setPhoneSent(true);
      setCooldown(RESEND_SECONDS);
      setInfo(`A code was sent to ${status?.phone_masked ?? "your phone"}.`);
    });
  const onVerifyPhone = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await verifyPhoneOtp(code);
      setCode("");
      setInfo(r.message);
      await loadStatus();
    });
  };

  const messages = (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {info && (
        <div role="status" className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {info}
        </div>
      )}
    </>
  );

  const backToLogin = (
    <Link to="/login" onClick={() => setVerificationToken(null)} className="font-medium text-primary hover:underline">
      Back to sign in
    </Link>
  );

  if (phase === "loading") {
    return <AuthShell title="Verification"><p role="status" className="text-center text-sm text-muted-foreground">Loading…</p></AuthShell>;
  }

  if (phase === "expired") {
    return (
      <AuthShell title="Verification session ended">
        <p className="mb-5 text-center text-sm text-muted-foreground">
          For your security this page forgets your session when it is closed or refreshed.
          Sign in with your username and password to continue verification.
        </p>
      <Button variant="gradient" className="w-full" onClick={() => {
    window.location.href = "/login";
  }}
>
</Button>
      </AuthShell>
    );
  }

  if (phase === "error" || !status) {
    return (
      <AuthShell title="Verification">
        {messages}
        <Button variant="outline" className="w-full" onClick={() => { setError(""); setPhase("loading"); void loadStatus(); }}>
          Try again
        </Button>
      </AuthShell>
    );
  }

  const step = status.next_step;

  if (step === "awaiting_approval" || step === "done") {
    return (
      <AuthShell title={step === "done" ? "Account ready" : "Waiting for approval"} footer={backToLogin}>
        <VerificationSteps current={3} />
        {messages}
        <p className="text-center text-sm text-muted-foreground">
          {step === "done"
            ? "Your account is active. You can sign in now."
            : "Your email and phone are verified. An administrator must approve your account before you can sign in. We cannot notify you automatically, so try signing in again later."}
        </p>
      </AuthShell>
    );
  }

  if (step === "verify_phone") {
    return (
      <AuthShell title="Verify your phone" subtitle={`SMS code for ${status.phone_masked}`} footer={backToLogin}>
        <VerificationSteps current={2} />
        {messages}
        <div className="space-y-4">
          <Button
            type="button"
            variant={phoneSent ? "outline" : "gradient"}
            className="w-full"
            onClick={onSendPhone}
            disabled={busy || cooldown > 0}
          >
            {cooldown > 0 ? `Resend code (${cooldown}s)` : phoneSent ? "Resend code" : "Send code by SMS"}
          </Button>
          <CodeEntry id="phone-code" value={code} onChange={setCode} onSubmit={onVerifyPhone} busy={busy} />
        </div>
      </AuthShell>
    );
  }

  // verify_email
  return (
    <AuthShell title="Verify your email" subtitle={`Check ${status.email_masked}`} footer={backToLogin}>
      <VerificationSteps current={1} />
      {signup?.emailSent === false && (
        <div role="alert" className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
          Your account was created, but the email could not be sent yet. Press Resend.
        </div>
      )}
      {messages}
      <p className="mb-4 text-sm text-muted-foreground">
        The email contains a 6-digit code and a link. Either one verifies your email: enter the code
        below or open the link. The code expires after a few minutes.
      </p>
      <div className="space-y-4">
        <CodeEntry id="email-code" value={code} onChange={setCode} onSubmit={onVerifyEmail} busy={busy} />
        <Button type="button" variant="outline" className="w-full" onClick={onResendEmail} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Resend email (${cooldown}s)` : "Resend email"}
        </Button>
      </div>
    </AuthShell>
  );
}