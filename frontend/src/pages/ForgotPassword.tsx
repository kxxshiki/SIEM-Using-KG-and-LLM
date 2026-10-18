import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword, toProblem } from "@/lib/authApi";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    setError("");
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError("");
    busy.current = true;
    setSubmitting(true);
    try {
      const r = await forgotPassword(value);
      setDone(r.message); // same neutral message whether or not the account exists
    } catch (err) {
      setError(toProblem(err, "Could not send the request. Please try again.").message);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const back = (
    <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
  );

  if (done) {
    return (
      <AuthShell title="Check your email" footer={back}>
        <p role="status" className="text-center text-sm text-muted-foreground">{done}</p>
        <p className="mt-3 text-center text-xs text-muted-foreground">The link works once and expires soon.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="Enter your email and we will send a reset link." footer={back}>
      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">Email address</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "forgot-email-error" : undefined}
          />
          {fieldError && <p id="forgot-email-error" role="alert" className="text-xs text-red-600 dark:text-red-400">{fieldError}</p>}
        </div>
        <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}