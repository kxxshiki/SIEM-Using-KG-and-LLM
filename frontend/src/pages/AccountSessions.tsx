import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { listAccountSessions, revokeAccountSession, toProblem, type AccountSession } from "@/lib/authApi";

function deviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent) ? "Microsoft Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  const os = /Windows/.test(userAgent) ? "Windows" : /Mac OS/.test(userAgent) ? "macOS" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Linux/.test(userAgent) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

function formatUtc(value: string): string {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`).toLocaleString();
}

export default function AccountSessions() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setSessions(await listAccountSessions()); setError(""); }
    catch (err) { setError(toProblem(err).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function revoke(session: AccountSession) {
    setBusy(session.id);
    setError("");
    try {
      await revokeAccountSession(session.id);
      if (session.current) logout();
      else await load();
    } catch (err) { setError(toProblem(err).message); }
    finally { setBusy(null); }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Account preferences</Link>
      <header><h1 className="text-2xl font-bold">Manage accounts</h1><p className="mt-1 text-sm text-muted-foreground">These are the browsers and devices currently signed in to your account.</p></header>
      {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
      {sessions.length === 0 && !error && <p className="rounded-xl border bg-card/80 p-5 text-sm text-muted-foreground">No active sign-in sessions were found.</p>}
      <ul className="space-y-3">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/85 p-4 shadow-sm backdrop-blur-md">
            {session.user_agent && /Android|iPhone|iPad/i.test(session.user_agent) ? <Smartphone className="text-primary" /> : <Monitor className="text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{deviceName(session.user_agent)}{session.current && <span className="ml-2 text-xs font-medium text-primary">This device</span>}</p>
              <p className="text-sm text-muted-foreground">{session.ip_address ?? "IP unavailable"} · Signed in {formatUtc(session.created_at)}</p>
              <p className="text-xs text-muted-foreground">Session expires {formatUtc(session.expires_at)}</p>
            </div>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void revoke(session)}>{busy === session.id ? "Signing out…" : "Sign out"}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
