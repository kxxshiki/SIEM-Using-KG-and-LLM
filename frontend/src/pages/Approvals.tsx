import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { useCachedQuery } from "@/lib/queryCache";
import { approveUser, listPendingUsers, rejectUser, toProblem, type PendingUser } from "@/lib/authApi";

export default function Approvals() {
  const { data: users, error, refresh, mutate } = useCachedQuery<PendingUser[]>(
    "pending-users",
    listPendingUsers,
    { pollMs: 15000 }
  );
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const act = async (u: PendingUser, kind: "approve" | "reject") => {
    if (kind === "reject" && !window.confirm(`Reject ${u.username}? They will not be able to sign in.`)) return;
    setBusyId(u.id);
    setActionError("");
    try {
      if (kind === "approve") await approveUser(u.id);
      else await rejectUser(u.id);
      mutate((list) => (list ? list.filter((x) => x.id !== u.id) : list));
    } catch (err) {
      setActionError(toProblem(err).message);
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  const message = actionError || (error ? toProblem(error, "Could not load the list.").message : "");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Account approvals</h1>
        <p className="text-sm text-muted-foreground">
          These users verified their email and phone. Approve only people you recognise.
        </p>
      </div>

      {message && (
        <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {message}
        </div>
      )}

      {users === undefined && !error && (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading</span>
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border bg-card" />
          ))}
        </div>
      )}
      {users && users.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No users are waiting for approval.
        </p>
      )}

      <ul className="space-y-3">
        {users?.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{u.username}{u.full_name ? ` · ${u.full_name}` : ""}</p>
              <p className="truncate text-muted-foreground">{u.email} · {u.phone_e164 ?? "no phone"}</p>
              <p className="text-xs text-muted-foreground">Registered {formatDateTime(u.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void act(u, "approve")} disabled={busyId === u.id}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => void act(u, "reject")} disabled={busyId === u.id}>Reject</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}