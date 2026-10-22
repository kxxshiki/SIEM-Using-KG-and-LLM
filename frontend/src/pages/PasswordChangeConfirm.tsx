import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { confirmPasswordChange, toProblem } from "@/lib/authApi";

export default function PasswordChangeConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [state, setState] = useState<{ loading: boolean; message: string; error: string }>({ loading: true, message: "", error: "" });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get("token") ?? "";
    navigate("/account/password/confirm", { replace: true });
    if (!token) { setState({ loading: false, message: "", error: "This confirmation link is incomplete." }); return; }
    confirmPasswordChange(token)
      .then((result) => setState({ loading: false, message: result.message, error: "" }))
      .catch((err) => setState({ loading: false, message: "", error: toProblem(err, "Could not confirm this password change.").message }));
  }, [navigate, params]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4">
      <section className="w-full space-y-4 rounded-2xl border bg-card/90 p-6 text-center shadow-xl backdrop-blur-md">
        <h1 className="text-2xl font-bold">{state.loading ? "Confirming password change" : state.error ? "Link not accepted" : "Password updated"}</h1>
        {state.loading ? <p role="status" className="text-sm text-muted-foreground">Please wait…</p> : state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
        {!state.loading && <Link to="/login"><Button variant="gradient" className="w-full">Go to sign in</Button></Link>}
      </section>
    </main>
  );
}
