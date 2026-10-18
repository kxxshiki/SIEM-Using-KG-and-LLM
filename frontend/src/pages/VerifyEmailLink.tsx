import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { hasVerificationToken, toProblem, verifyEmailLink, type NextStep } from "@/lib/authApi";

type State =
  | { kind: "loading" }
  | { kind: "ok"; next: NextStep }
  | { kind: "error"; message: string };

export default function VerifyEmailLink() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tokenRef = useRef(params.get("token") ?? "");
  const started = useRef(false);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (started.current) return; // React StrictMode runs effects twice in development
    started.current = true;
    navigate("/verify-email", { replace: true }); // removes the token from the address bar

    const token = tokenRef.current;
    tokenRef.current = "";
    if (!token) {
      setState({ kind: "error", message: "This link is incomplete. Use the code from your email instead." });
      return;
    }
    verifyEmailLink(token)
      .then((r) => setState({ kind: "ok", next: r.next_step }))
      .catch((err) => setState({ kind: "error", message: toProblem(err, "Could not verify this link.").message }));
  }, [navigate]);

  if (state.kind === "loading") {
    return <AuthShell title="Verifying your email"><p role="status" className="text-center text-sm text-muted-foreground">Please wait…</p></AuthShell>;
  }

  if (state.kind === "error") {
    return (
      <AuthShell title="Link not accepted">
        <div role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {state.message}
        </div>
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Sign in to continue verification, where you can request a new email.
        </p>
        <Link to="/login"><Button variant="gradient" className="w-full" type="button">Go to sign in</Button></Link>
      </AuthShell>
    );
  }

  const next = state.next;
  return (
    <AuthShell title="Email verified">
      <p role="status" className="mb-5 text-center text-sm text-muted-foreground">
        {next === "verify_phone"
          ? "Next step: verify your phone number."
          : next === "awaiting_approval"
          ? "Your account now waits for administrator approval."
          : "Your account is ready."}
      </p>
      <Link to={next === "verify_phone" && hasVerificationToken() ? "/verify" : "/login"}>
        <Button variant="gradient" className="w-full" type="button">
          {next === "verify_phone" ? "Continue" : "Go to sign in"}
        </Button>
      </Link>
    </AuthShell>
  );
}