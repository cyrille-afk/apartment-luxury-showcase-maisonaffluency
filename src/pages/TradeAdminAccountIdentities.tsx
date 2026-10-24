import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { listDuplicateAccounts, resolveDuplicateAccount } from "@/lib/duplicateAccounts.functions";
import type { AccountEvidence, DuplicateGroup, ReviewDecision } from "@/lib/duplicateAccounts";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : "—");

function Evidence({ a }: { a: AccountEvidence }) {
  return (
    <ul className="font-body text-xs text-muted-foreground space-y-0.5">
      <li className="text-foreground">{a.email || "(no email)"} {a.suspended && <span className="text-destructive">· suspended</span>}</li>
      <li>Email &amp; password: {a.hasPassword ? (a.emailConfirmed ? "yes, email confirmed" : "yes, email NOT confirmed") : "no"}</li>
      <li>Google: {a.googleEmail ? `${a.googleEmail} (${a.googleEmailVerified ? "verified by Google" : "not verified"})` : "not connected"}</li>
      <li>Created {fmt(a.createdAt)} · Last sign-in {fmt(a.lastSignInAt)}</li>
      <li className="opacity-60">ID {a.userId}</li>
    </ul>
  );
}

function GroupCard({ group, onDone }: { group: DuplicateGroup; onDone: () => void }) {
  const resolve = useServerFn(resolveDuplicateAccount);
  const [primary, setPrimary] = useState(group.accounts[0].userId);
  const [duplicate, setDuplicate] = useState(group.accounts[1].userId);
  const [pwOk, setPwOk] = useState(false);
  const [googleOk, setGoogleOk] = useState(false);
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: (decision: ReviewDecision) =>
      resolve({ data: { key: group.key, primaryUserId: primary, duplicateUserId: duplicate, decision, passwordVerified: pwOk, googleVerified: googleOk, notes } }),
    onSuccess: () => { toast.success("Review saved"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dupSuspended = group.accounts.find((a) => a.userId === duplicate)?.suspended;

  return (
    <section className="rounded-lg border border-border p-4 space-y-4" data-testid="duplicate-group">
      <h2 className="font-display text-base text-foreground">{group.key}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {group.accounts.map((a) => (
          <div key={a.userId} className="rounded border border-border p-3 space-y-2">
            <Evidence a={a} />
            <div className="flex gap-4 font-body text-xs">
              <label className="flex items-center gap-1"><input type="radio" checked={primary === a.userId} onChange={() => setPrimary(a.userId)} /> Keep</label>
              <label className="flex items-center gap-1"><input type="radio" checked={duplicate === a.userId} onChange={() => setDuplicate(a.userId)} /> Duplicate</label>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1 font-body text-xs text-foreground">
        <label className="flex items-center gap-2"><input type="checkbox" checked={pwOk} onChange={(e) => setPwOk(e.target.checked)} /> I verified the user controls the email-and-password account (e.g. they replied from that inbox or signed in while on a call).</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={googleOk} onChange={(e) => setGoogleOk(e.target.checked)} /> I verified the user controls the Google account.</label>
      </div>
      <textarea className="w-full rounded border border-border bg-background p-2 font-body text-xs" rows={2} maxLength={2000} placeholder="How identity was verified (required for your records)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className="rounded border border-border px-3 py-1.5 font-body text-xs" disabled={m.isPending} onClick={() => m.mutate("keep_both")}>Keep both</button>
        {dupSuspended ? (
          <button className="rounded border border-border px-3 py-1.5 font-body text-xs" disabled={m.isPending} onClick={() => m.mutate("restore_duplicate")}>Restore duplicate</button>
        ) : (
          <button className="rounded bg-destructive px-3 py-1.5 font-body text-xs text-destructive-foreground disabled:opacity-50" disabled={m.isPending || !pwOk || !googleOk || primary === duplicate} onClick={() => m.mutate("suspend_duplicate")}>Suspend duplicate sign-in</button>
        )}
      </div>
    </section>
  );
}

export default function TradeAdminAccountIdentities() {
  const { user, isAdmin, loading, rolesLoaded } = useAuth();
  const list = useServerFn(listDuplicateAccounts);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-duplicate-accounts"], queryFn: () => list(), enabled: !!user && isAdmin });

  if (loading || (user && !rolesLoaded && !isAdmin)) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground mb-2">Duplicate account review</h1>
        <p className="font-body text-sm text-muted-foreground">
          Accounts sharing an email or Google address. Confirm the person controls both identities before suspending a duplicate. Suspending blocks sign-in only; no data is deleted and it can be restored.
        </p>
      </div>
      {q.isLoading && <p className="font-body text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="font-body text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && q.data.groups.length === 0 && <p className="font-body text-sm text-muted-foreground">No duplicate accounts found.</p>}
      {q.data?.groups.map((g) => (
        <GroupCard key={g.key} group={g} onDone={() => qc.invalidateQueries({ queryKey: ["admin-duplicate-accounts"] })} />
      ))}
      {!!q.data?.reviews.length && (
        <section>
          <h2 className="font-display text-base text-foreground mb-2">Review history</h2>
          <ul className="font-body text-xs text-muted-foreground space-y-1">
            {q.data.reviews.map((r: any) => (
              <li key={r.id}>{fmt(r.created_at)} · {r.email_key} · {r.decision.replace(/_/g, " ")}{r.notes ? ` — ${r.notes}` : ""}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
