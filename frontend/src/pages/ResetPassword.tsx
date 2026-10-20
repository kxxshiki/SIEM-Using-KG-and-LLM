import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import PasswordField from "@/components/auth/PasswordField";
import PasswordRequirements from "@/components/auth/PasswordRequirements";
import { Button } from "@/components/ui/button";
import { evaluatePassword, PASSWORD_RULES_MESSAGE } from "@/lib/passwordPolicy";
import { resetPassword, toProblem, validateResetToken } from "@/lib/authApi";

type Phase = "checking" | "valid" | "invalid" | "error";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tokenRef = useRef(params.get("token") ?? "");
  const started = useRef(false);
  const busy = useRef(false);

  const [phase, setPhase] = useState<Phase>("checking");
  const [problem, setProblem] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rulesOk = evaluatePassword(password).allMet;
  const passwordError =
    (touched || submitted) && !rulesOk
      ? password
        ? PASSWORD_RULES_MESSAGE
        : "Enter a password."
      : "";

  const check = useCallback(async () => {
    const token = tokenRef.current;

    if (!token) {
      setPhase("invalid");
      return;
    }

    setPhase("checking");

    try {
      const r = await validateResetToken(token);
      setPhase(r.valid ? "valid" : "invalid");
    } catch (err) {
      setProblem(toProblem(err, "Could not check the link.").message);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (started.current) return;

    started.current = true;
    navigate("/reset-password", { replace: true });
    void check();
  }, [check, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (busy.current) return;

    setFormError("");
    setConfirmError("");
    setSubmitted(true);

    if (!rulesOk) {
      document.getElementById("reset-password")?.focus();
      return;
    }

    if (password !== confirm) {
      setConfirmError("Passwords do not match.");
      document.getElementById("reset-confirm")?.focus();
      return;
    }

    busy.current = true;
    setSubmitting(true);

    try {
      await resetPassword({
        token: tokenRef.current,
        new_password: password,
        confirm_password: confirm,
      });

      tokenRef.current = "";

      navigate("/login", {
        replace: true,
        state: {
          notice: "Password updated. Sign in with your new password.",
        },
      });
    } catch (err) {
      const p = toProblem(err, "Could not reset the password. Please try again.");

      if (p.status === 400) {
        setPhase("invalid");
      } else {
        setFormError(p.message);
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const back = (
    <Link to="/login" className="font-medium text-primary hover:underline">
      Back to sign in
    </Link>
  );

  if (phase === "checking") {
    return (
      <AuthShell title="Reset password">
        <p
          role="status"
          className="text-center text-sm text-muted-foreground"
        >
          Checking your link…
        </p>
      </AuthShell>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthShell title="Link not valid" footer={back}>
        <p
          role="alert"
          className="mb-4 text-center text-sm text-muted-foreground"
        >
          This reset link is invalid, expired or already used.
        </p>

        <Link to="/forgot-password">
          <Button
            type="button"
            variant="gradient"
            className="w-full"
          >
            Request a new link
          </Button>
        </Link>
      </AuthShell>
    );
  }

  if (phase === "error") {
    return (
      <AuthShell title="Reset password" footer={back}>
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {problem}
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void check()}
        >
          Try again
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" footer={back}>
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <PasswordField
          id="reset-password"
          label="New password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched(true)}
          autoComplete="new-password"
          error={passwordError}
          errorAction={
            <PasswordRequirements
              id="reset-rules"
              password={password}
              defaultOpen
            />
          }
          disabled={submitting}
        />

        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={confirmError}
          disabled={submitting}
        />

        <Button
          type="submit"
          variant="gradient"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </AuthShell>
  );
}