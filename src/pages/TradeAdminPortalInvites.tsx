import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { Copy, Plus, Ban, CheckCircle2 } from "lucide-react";

type InviteRow = {
  id: string;
  code: string;
  code_type: "single_use" | "campaign";
  max_uses: number;
  uses_count: number;
  campaign_name: string | null;
  invited_name: string | null;
  invited_company: string | null;
  notes: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

export default function TradeAdminPortalInvites() {
  const { user, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    code: randomCode(),
    code_type: "single_use" as "single_use" | "campaign",
    max_uses: 1,
    campaign_name: "",
    invited_name: "",
    invited_company: "",
    notes: "",
    expires_at: "",
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["portal-invites"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_invites")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as InviteRow[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        code_type: form.code_type,
        max_uses: form.code_type === "single_use" ? 1 : Math.max(1, Number(form.max_uses) || 1),
        campaign_name: form.campaign_name.trim() || null,
        invited_name: form.invited_name.trim() || null,
        invited_company: form.invited_company.trim() || null,
        notes: form.notes.trim() || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        created_by: user?.id ?? null,
      };
      const { error } = await supabase.from("portal_invites").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invite created" });
      setForm((f) => ({ ...f, code: randomCode(), invited_name: "", invited_company: "", notes: "" }));
      qc.invalidateQueries({ queryKey: ["portal-invites"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async (row: InviteRow) => {
      const { error } = await supabase
        .from("portal_invites")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-invites"] }),
  });

  if (loading) return null;
  if (!user || !isAdmin) return <Navigate to="/trade" replace />;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <Helmet><title>Portal Invites · Admin</title></Helmet>

      <div>
        <h1 className="font-serif text-2xl text-foreground">China Portal · Invitation Codes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Issue single-use codes for individual recipients or campaign codes with a redemption cap.
        </p>
      </div>

      {/* Create form */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground">New invitation</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Code</label>
            <div className="flex gap-2">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono tracking-widest"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, code: randomCode() })}
                className="text-xs px-2 border border-border rounded hover:bg-muted"
              >
                ↻
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={form.code_type}
              onChange={(e) => setForm({ ...form, code_type: e.target.value as any })}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            >
              <option value="single_use">Single-use</option>
              <option value="campaign">Campaign (multi-use)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max uses</label>
            <input
              type="number"
              min={1}
              disabled={form.code_type === "single_use"}
              value={form.code_type === "single_use" ? 1 : form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Invited name</label>
            <input
              value={form.invited_name}
              onChange={(e) => setForm({ ...form, invited_name: e.target.value })}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Company / Studio</label>
            <input
              value={form.invited_company}
              onChange={(e) => setForm({ ...form, invited_company: e.target.value })}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Campaign name</label>
            <input
              value={form.campaign_name}
              onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
              placeholder="e.g. Design Shanghai 2026"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Notes (internal)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Expires at</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Create invite
        </button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Uses</th>
              <th className="text-left px-4 py-3">Invitee</th>
              <th className="text-left px-4 py-3">Expires</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td className="p-6 text-muted-foreground" colSpan={8}>Loading…</td></tr>
            )}
            {rows?.map((r) => {
              const exhausted = r.uses_count >= r.max_uses;
              const expired = r.expires_at ? new Date(r.expires_at).getTime() < Date.now() : false;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono tracking-widest">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(r.code);
                        toast({ title: "Copied", description: r.code });
                      }}
                      className="inline-flex items-center gap-2 hover:text-primary"
                    >
                      {r.code} <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{r.code_type.replace("_", " ")}</td>
                  <td className="px-4 py-3">{r.uses_count} / {r.max_uses}</td>
                  <td className="px-4 py-3">
                    <div>{r.invited_name || <span className="text-muted-foreground">—</span>}</div>
                    <div className="text-xs text-muted-foreground">{r.invited_company}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.expires_at ? format(new Date(r.expires_at), "PP") : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    {!r.is_active || exhausted || expired ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Ban className="h-3 w-3" />
                        {expired ? "Expired" : exhausted ? "Used up" : "Disabled"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleMut.mutate(r)}
                      className="text-xs px-2 py-1 border border-border rounded hover:bg-muted"
                    >
                      {r.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && rows?.length === 0 && (
              <tr><td className="p-6 text-muted-foreground" colSpan={8}>No invitations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
