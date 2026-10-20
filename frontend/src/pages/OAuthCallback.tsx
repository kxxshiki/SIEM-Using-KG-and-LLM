import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { exchangeOAuthCode, toProblem } from "@/lib/authApi";
import { oauthMessage } from "@/lib/oauthMessages";

type View =
  | { kind: "working" }
  | { kind: "notice"; title: string; text: string }
  | { kind: "error"; text: string };

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const initial = useRef({
    code: params.get("code") ?? "",
    status: params.get("status") ?? "",
    error: params.get("error") ?? "",
  });
  const started = useRef(false);
  const [view, setView] = useState<View>({ kind: "working" });

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    navigate("/oauth/callback", { replace: true }); // removes the code from the address bar
    const { code, status, error } = initial.current;
    initial.current = { code: "", status: "", error: "" };

    if (error) {
      setView({ kind: "error", text: oauthMessage(error) });
      return;
    }
    if (status === "awaiting_approval") {
      setView({
        kind: "notice",
        title: "Waiting for approval",
        text: "Your provider account is verified. An administrator must approve your account before you can sign in. Try again later.",
      });
      return;
    }
    if (status === "pending") {
      setView({
        kind: "notice",
        title: "Account not active yet",
        text: "Finish email and phone verification by signing in with your username and password.",
      });
      return;
    }
    if (!code) {
      setView({ kind: "error", text: oauthMessage("invalid_state") });
      return;
    }
    exchangeOAuthCode(code)
      .then((res) => {
        loginWithToken(res);
        navigate("/", { replace: true });
      })
      .catch((err) => setView({ kind: "error", text: toProblem(err, oauthMessage("try_again")).message }));
  }, [navigate, loginWithToken]);

  const back = (
    <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
  );

  if (view.kind === "working") {
    return (
      <AuthShell title="Signing you in">
        <p role="status" className="text-center text-sm text-muted-foreground">Please wait…</p>
      </AuthShell>
    );
  }
  if (view.kind === "notice") {
    return (
      <AuthShell title={view.title} footer={back}>
        <p role="status" className="text-center text-sm text-muted-foreground">{view.text}</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Sign-in failed" footer={back}>
      <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
        {view.text}
      </div>
      <Link to="/login" className="mt-4 block">
        <Button type="button" variant="gradient" className="w-full">Try again</Button>
      </Link>
    </AuthShell>
  );
}