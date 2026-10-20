import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  createLinkTicket, getOAuthProviders, listIdentities, oauthStartUrl, toProblem,
  type OAuthIdentity, type OAuthProvider,
} from "@/lib/authApi";
import { oauthMessage, PROVIDER_NAMES } from "@/lib/oauthMessages";

const ALL: OAuthProvider[] = ["google", "github"];
type Msg = { type: "ok" | "error"; text: string } | null;

export default function ConnectedAccounts() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [available, setAvailable] = useState<Record<OAuthProvider, boolean> | null>(null);
  const [linked, setLinked] = useState<OAuthIdentity[]>([]);
  const [message, setMessage] = useState<Msg>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([getOAuthProviders(), listIdentities()]);
      setAvailable(a);
      setLinked(i);
    } catch (err) {
      setMessage({ type: "error", text: toProblem(err).message });
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ok = params.get("linked");
    const err = params.get("error");
    if (ok) setMessage({ type: "ok", text: `${PROVIDER_NAMES[ok] ?? "Account"} connected.` });
    else if (err) setMessage({ type: "error", text: oauthMessage(err) });
    if (ok || err) navigate("/account/connections", { replace: true });
    void load();
  }, [params, navigate, load]);

  const connect = async (p: OAuthProvider) => {
    setBusy(p);
    setMessage(null);
    try {
      const ticket = await createLinkTicket(p);
      window.location.assign(oauthStartUrl(p, ticket));
    } catch (err) {
      setMessage({ type: "error", text: toProblem(err).message });
      setBusy(null);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Connected accounts</h1>
        <p className="text-sm text-muted-foreground">
          Connect Google or GitHub to sign in with one click. Your password keeps working.
        </p>
      </div>

      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={
            message.type === "error"
              ? "rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
              : "rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400"
          }
        >
          {message.text}
        </div>
      )}

      <ul className="space-y-3">
        {ALL.map((p) => {
          const identity = linked.find((i) => i.provider === p);
          const enabled = available?.[p] ?? false;
          return (
            <li key={p} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{PROVIDER_NAMES[p]}</p>
                <p className="truncate text-muted-foreground">
                  {identity ? `Connected${identity.email ? ` as ${identity.email}` : ""}` : enabled ? "Not connected" : "Not configured on this server"}
                </p>
              </div>
              {!identity && (
                <Button size="sm" variant="outline" disabled={!enabled || busy !== null} onClick={() => void connect(p)}>
                  {busy === p ? "Redirecting…" : "Connect"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}