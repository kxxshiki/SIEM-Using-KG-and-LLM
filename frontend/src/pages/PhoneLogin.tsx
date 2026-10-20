import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import CodeEntry from "@/components/auth/CodeEntry";
import PhoneInput from "@/components/auth/PhoneInput";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { buildE164, DEFAULT_ISO, isPlausibleNational } from "@/lib/phone";
import { useCooldown } from "@/lib/useCooldown";
import { sendPhoneLoginCode, toProblem, verifyPhoneLoginCode } from "@/lib/authApi";

const RESEND_SECONDS = 60;

export default function PhoneLogin() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [iso, setIso] = useState(DEFAULT_ISO);
  const [national, setNational] = useState("");
  const [numberError, setNumberError] = useState("");
  const [stage, setStage] = useState<"number" | "code">("number");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const lock = useRef(false);
  const [cooldown, setCooldown] = useCooldown();

  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const sendCode = () => {
    if (!isPlausibleNational(national)) {
      setNumberError("Enter your mobile number.");
      document.getElementById("phone-login-number")?.focus();
      return;
    }
    setNumberError("");
    void run(async () => {
      try {
        const r = await sendPhoneLoginCode(buildE164(iso, national));
        setStage("code");
        setCode("");
        setCooldown(RESEND_SECONDS);
        setInfo(r.message);
      } catch (err) {
        const p = toProblem(err, "Could not send the code. Please try again.");
        setError(p.message);
        if (p.status === 429 && p.retryAfter) setCooldown(p.retryAfter);
      }
    });
  };

  const verify = () =>
    void run(async () => {
      try {
        const res = await verifyPhoneLoginCode(buildE164(iso, national), code);
        loginWithToken(res);
        navigate("/", { replace: true });
      } catch (err) {
        setError(toProblem(err, "Could not sign in. Please try again.").message);
      }
    });

  const back = (
    <Link to="/login" className="font-semibold text-brand-purple hover:underline">
      Sign in with your password instead
    </Link>
  );

  return (
    <AuthShell
      title="Sign in with your phone"
      subtitle="We will text you a 6-digit code. Only accounts with a verified phone number can use this."
      footer={back}
    >
      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {stage === "number" ? (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            sendCode();
          }}
          noValidate
          className="space-y-4"
        >
          <PhoneInput
            id="phone-login-number"
            label="Mobile Number"
            iso={iso}
            onIsoChange={setIso}
            national={national}
            onNationalChange={setNational}
            error={numberError}
            disabled={busy}
          />
          <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={busy || cooldown > 0}>
            {busy ? "Sending…" : cooldown > 0 ? `Wait ${cooldown}s` : "Send code"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          {info && <p role="status" className="text-sm text-muted-foreground">{info}</p>}
          <CodeEntry id="phone-login-code" value={code} onChange={setCode} onSubmit={verify} busy={busy} buttonLabel="Sign in" />
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={sendCode} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setStage("number"); setError(""); }} disabled={busy}>
              Use a different number
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}