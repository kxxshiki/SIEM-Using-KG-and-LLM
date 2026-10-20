
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import CodeEntry from "@/components/auth/CodeEntry";
import PasswordField from "@/components/auth/PasswordField";
import PasswordRequirements from "@/components/auth/PasswordRequirements";
import PhoneInput from "@/components/auth/PhoneInput";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluatePassword } from "@/lib/passwordPolicy";
import { buildE164, DEFAULT_ISO, isPlausibleNational } from "@/lib/phone";
import { useCooldown } from "@/lib/useCooldown";
import {
  registerAccount,
  sendSignupEmailCode,
  setVerificationToken,
  toProblem,
  verifySignupEmailCode,
} from "@/lib/authApi";

type FieldKey = "email" | "phone" | "username" | "password" | "confirm";
type Busy = "" | "send" | "verify" | "submit";

const IDS: Record<FieldKey, string> = {
  email: "reg-email",
  phone: "reg-phone",
  username: "reg-username",
  password: "reg-password",
  confirm: "reg-confirm",
};

const ORDER: FieldKey[] = ["email", "phone", "username", "password", "confirm"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;

  return (
    <p id={id} role="alert" className="text-xs text-red-600 dark:text-red-400">
      {text}
    </p>
  );
}

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [iso, setIso] = useState(DEFAULT_ISO);
  const [national, setNational] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState("");
  const [emailError, setEmailError] = useState("");

  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<Busy>("");

  const lock = useRef(false);
  const [cooldown, setCooldown] = useCooldown();

  // Show the password requirements when the registration page opens.
  const [rulesOpen, setRulesOpen] = useState(true);

  const errors = useMemo(() => {
    const e: Partial<Record<FieldKey, string>> = {};

    if (!EMAIL_RE.test(email.trim())) {
      e.email = "Enter a valid email address.";
    }

    if (!isPlausibleNational(national)) {
      e.phone = "Enter your mobile number.";
    }

    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username.trim())) {
      e.username = "3-32 characters: letters, numbers, dot, dash or underscore.";
    }

    if (!evaluatePassword(password, username).allMet) {
      e.password = "Password does not meet all requirements.";
    }

    if (confirm !== password) {
      e.confirm = "Passwords do not match.";
    }

    return e;
  }, [email, national, username, password, confirm]);

  const shown = (k: FieldKey) =>
    submitted || touched[k] ? errors[k] : undefined;

  const touch = (k: FieldKey) =>
    setTouched((t) => ({ ...t, [k]: true }));

  const run = async (
    kind: Exclude<Busy, "">,
    fn: () => Promise<void>,
  ) => {
    if (lock.current) return;

    lock.current = true;
    setBusy(kind);

    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy("");
    }
  };

  const onSendCode = () => {
    setEmailError("");
    setEmailNote("");

    if (!EMAIL_RE.test(email.trim())) {
      touch("email");
      document.getElementById(IDS.email)?.focus();
      return;
    }

    void run("send", async () => {
      try {
        await sendSignupEmailCode(email.trim());
        setCodeSent(true);
        setCode("");
        setCooldown(RESEND_SECONDS);
        setEmailNote("We sent a 6-digit code to your email.");
      } catch (err) {
        const p = toProblem(err, "Could not send the code. Please try again.");
        setEmailError(p.message);

        if (p.status === 429 && p.retryAfter) {
          setCooldown(p.retryAfter);
        }
      }
    });
  };

  const onVerifyCode = () => {
    setEmailError("");

    void run("verify", async () => {
      try {
        const r = await verifySignupEmailCode(email.trim(), code);
        setProof(r.email_proof);
        setCodeSent(false);
        setCode("");
        setEmailNote("");
      } catch (err) {
        setEmailError(
          toProblem(err, "Could not check the code. Please try again.").message,
        );
      }
    });
  };

  const onChangeEmail = () => {
    setProof(null);
    setCodeSent(false);
    setCode("");
    setEmailNote("");
    setEmailError("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitted(true);

    if (!proof) {
      setEmailError("Verify your email first.");
      document.getElementById(IDS.email)?.focus();
      return;
    }

    const firstBad = ORDER.find((k) => errors[k]);

    if (firstBad) {
      if (errors.password) {
        setRulesOpen(true);
      }

      document.getElementById(IDS[firstBad])?.focus();
      return;
    }

    void run("submit", async () => {
      try {
        const res = await registerAccount({
          username: username.trim(),
          email: email.trim(),
          phone: buildE164(iso, national),
          password,
          confirm_password: confirm,
          email_proof: proof,
        });

        setVerificationToken(res.verification_token);
        navigate("/verify", { replace: true });
      } catch (err) {
        const p = toProblem(err, "Could not create the account. Please try again.");

        if (p.status === 400) {
          setProof(null);
          setEmailError(p.message);
        } else {
          setFormError(p.message);
        }
      }
    });
  };

  const emailMessage = emailError || shown("email");

  return (
    <AuthShell
      title="Create your account"
      subtitle="Create your account to get started."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand-purple hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={IDS.email}>Email address</Label>

          <div className="flex gap-2">
            <Input
              id={IDS.email}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCodeSent(false);
              }}
              onBlur={() => touch("email")}
              disabled={Boolean(proof) || busy !== ""}
              aria-invalid={emailMessage ? true : undefined}
              aria-describedby={emailMessage ? "reg-email-error" : undefined}
            />

            {proof ? (
              <Button
                type="button"
                variant="outline"
                onClick={onChangeEmail}
                disabled={busy !== ""}
              >
                Change
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onSendCode}
                disabled={busy !== "" || cooldown > 0}
              >
                {cooldown > 0
                  ? `${cooldown}s`
                  : codeSent
                    ? "Resend"
                    : "Send code"}
              </Button>
            )}
          </div>

          {proof && (
            <p
              role="status"
              className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
            >
              <Check size={14} aria-hidden="true" />
              Email verified
            </p>
          )}

          {emailNote && (
            <p role="status" className="text-xs text-muted-foreground">
              {emailNote}
            </p>
          )}

          <FieldError id="reg-email-error" text={emailMessage} />
        </div>

        {codeSent && !proof && (
          <CodeEntry
            id="reg-email-code"
            value={code}
            onChange={setCode}
            onSubmit={onVerifyCode}
            busy={busy === "verify"}
          />
        )}

        <PhoneInput
          id={IDS.phone}
          label="Mobile Number"
          iso={iso}
          onIsoChange={setIso}
          national={national}
          onNationalChange={setNational}
          onBlur={() => touch("phone")}
          error={shown("phone")}
          disabled={busy === "submit"}
        />

        <div className="space-y-1.5">
          <Label htmlFor={IDS.username}>Username</Label>

          <Input
            id={IDS.username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => touch("username")}
            disabled={busy === "submit"}
            aria-invalid={shown("username") ? true : undefined}
            aria-describedby={
              shown("username") ? "reg-username-error" : undefined
            }
          />

          <FieldError id="reg-username-error" text={shown("username")} />
        </div>

        <PasswordField
          id={IDS.password}
          label="Password"
          placeholder="Password"
          value={password}
          onChange={setPassword}
          onBlur={() => touch("password")}
          autoComplete="new-password"
          error={shown("password")}
          describedBy="reg-password-rules"
          disabled={busy === "submit"}
        />

        <PasswordRequirements
          id="reg-password-rules"
          password={password}
          username={username}
          open={rulesOpen}
          onOpenChange={setRulesOpen}
        />

        <PasswordField
          id={IDS.confirm}
          label="Confirm Password"
          placeholder="Confirm password"
          value={confirm}
          onChange={setConfirm}
          onBlur={() => touch("confirm")}
          autoComplete="new-password"
          error={shown("confirm")}
          disabled={busy === "submit"}
        />

        <Button
          type="submit"
          className="h-11 w-full text-base font-semibold"
          disabled={busy !== ""}
        >
          {busy === "submit" ? "Creating account…" : "Create Account"}
        </Button>
      </form>
    </AuthShell>
  );
}
