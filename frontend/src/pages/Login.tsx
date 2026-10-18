import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthShell from "@/components/auth/AuthShell";
import PasswordField from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setVerificationToken, toProblem } from "@/lib/authApi";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return; // blocks double submits

    const name = username.trim();
    const uErr = name ? "" : "Enter your username, email or phone number.";
    const pErr = password ? "" : "Enter your password.";
    setUsernameError(uErr);
    setPasswordError(pErr);
    setError("");
    if (uErr || pErr) {
      document.getElementById(uErr ? "login-username" : "login-password")?.focus();
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      await login(name, password);
      // On success <PublicOnly> in App.tsx redirects to the dashboard.
    } catch (err) {
      const problem = toProblem(err, "Sign in failed. Please try again.");
      if (problem.status === 401) {
        setError("Incorrect username or password.");
      } else if (problem.code === "verification_required") {
        const token = problem.detail?.verification_token;
        if (typeof token === "string") setVerificationToken(token);
        navigate("/verify", { replace: true });
      } else {
        setError(problem.message);
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create account
          </Link>
        </>
      }
    >
      {notice && (
        <div role="status" className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-username">Username or email</Label>
          <Input
            id="login-username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            aria-invalid={usernameError ? true : undefined}
            aria-describedby={usernameError ? "login-username-error" : undefined}
          />
          {usernameError && (
            <p id="login-username-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
              {usernameError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-username">Username, email or phone</Label>
          <Input
            id="login-username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            aria-invalid={usernameError ? true : undefined}
            aria-describedby={["login-username-hint", usernameError ? "login-username-error" : ""].filter(Boolean).join(" ")}
          />
          <p id="login-username-hint" className="text-xs text-muted-foreground">
            Phone numbers: include the country code, for example +91.
          </p>
          {usernameError && (
            <p id="login-username-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
              {usernameError}
            </p>
          )}
        </div>

        <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}