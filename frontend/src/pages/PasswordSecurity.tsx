import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { requestPasswordChange, toProblem } from "@/lib/authApi";

export default function PasswordSecurity() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestPasswordChange({ email, new_password: password, confirm_password: confirm });
      setMessage(result.message);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(toProblem(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Account preferences</Link>
      <header>
        <h1 className="text-2xl font-bold">Password and security</h1>
        <p className="mt-1 text-sm text-muted-foreground">We’ll send a one-use confirmation link to your registered email before changing your password.</p>
      </header>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border bg-card/85 p-5 shadow-lg backdrop-blur-md">
        <label className="block space-y-1.5 text-sm font-medium">Registered email
          <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder={user?.email ?? "you@example.com"} />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">New password
          <Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">Confirm new password
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required maxLength={128} />
        </label>
        {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700">{message}</p>}
        <Button type="submit" variant="gradient" className="w-full" disabled={busy}>
          <ShieldCheck size={16} className="mr-2" />{busy ? "Sending confirmation…" : "Email password confirmation link"}
        </Button>
      </form>
    </section>
  );
}
