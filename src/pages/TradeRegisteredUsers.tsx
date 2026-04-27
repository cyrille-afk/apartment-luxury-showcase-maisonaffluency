import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, UserCheck, UserX, Clock, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { TIER_LABEL, TIER_DISCOUNT, type TradeTier } from "@/hooks/useTradeDiscount";

interface RegisteredUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  created_at: string;
  roles: string[];
  app_status: string | null;
  trade_tier: TradeTier;
  trade_tier_suggested: TradeTier | null;
  trade_tier_locked_by_admin: boolean;
  trade_tier_12mo_spend_cents: number;
  trade_tier_computed_at: string | null;
}

const normTier = (raw: unknown): TradeTier | null => {
  if (raw === "platinum" || raw === "gold" || raw === "silver") return raw;
  if (raw === "standard" || raw == null) return raw === "standard" ? "silver" : null;
  return null;
};

const fmtEur = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

const TIER_OPTIONS: TradeTier[] = ["silver", "gold", "platinum"];

const tierBadgeClass = (tier: TradeTier) => {
  switch (tier) {
    case "platinum":
      return "bg-zinc-900 text-zinc-50 border-zinc-700";
    case "gold":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "silver":
      return "bg-slate-100 text-slate-800 border-slate-300";
    default:
      return "bg-muted text-foreground border-border";
  }
};

export default function TradeRegisteredUsers() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-registered-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, company, created_at, trade_tier, trade_tier_suggested, trade_tier_locked_by_admin, trade_tier_12mo_spend_cents, trade_tier_computed_at")
        .order("created_at", { ascending: false });

      if (error || !profiles) return [];

      const [rolesRes, appsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("trade_applications").select("user_id, status").order("created_at", { ascending: false }),
      ]);

      const rolesMap = new Map<string, string[]>();
      (rolesRes.data || []).forEach((r: any) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      const appMap = new Map<string, string>();
      (appsRes.data || []).forEach((a: any) => {
        if (!appMap.has(a.user_id)) appMap.set(a.user_id, a.status);
      });

      return profiles.map((p: any): RegisteredUser => ({
        ...p,
        trade_tier: normTier(p.trade_tier) ?? "silver",
        trade_tier_suggested: normTier(p.trade_tier_suggested),
        trade_tier_locked_by_admin: !!p.trade_tier_locked_by_admin,
        trade_tier_12mo_spend_cents: Number(p.trade_tier_12mo_spend_cents ?? 0),
        trade_tier_computed_at: p.trade_tier_computed_at ?? null,
        roles: rolesMap.get(p.id) || [],
        app_status: appMap.get(p.id) || null,
      }));
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => {
      const name = `${u.first_name} ${u.last_name}`.toLowerCase();
      const month = format(new Date(u.created_at), "MMMM yyyy").toLowerCase();
      return (
        name.includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.company.toLowerCase().includes(q) ||
        month.includes(q) ||
        u.roles.some((r) => r.replace("_", " ").includes(q)) ||
        u.trade_tier.includes(q)
      );
    });
  }, [users, search]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const updateTier = async (userId: string, tier: TradeTier) => {
    setSavingId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ trade_tier: tier, trade_tier_locked_by_admin: true })
      .eq("id", userId);
    setSavingId(null);
    if (error) {
      toast({ title: "Failed to update tier", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Tier set to ${TIER_LABEL[tier]} (${Math.round(TIER_DISCOUNT[tier] * 100)}%)` });
    qc.invalidateQueries({ queryKey: ["admin-registered-users"] });
    qc.invalidateQueries({ queryKey: ["trade-tier"] });
  };

  const recomputeAll = async () => {
    const { data, error } = await supabase.rpc("recompute_trade_tier_suggestions");
    if (error) {
      toast({ title: "Failed to recompute", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Suggestions refreshed`, description: `${data ?? 0} profiles updated` });
    qc.invalidateQueries({ queryKey: ["admin-registered-users"] });
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-destructive/10 text-destructive",
      admin: "bg-primary/10 text-primary",
      trade_user: "bg-accent text-accent-foreground",
    };
    return (
      <span key={role} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[role] || "bg-muted text-muted-foreground"}`}>
        {role.replace("_", " ")}
      </span>
    );
  };

  const appStatusIcon = (status: string | null) => {
    if (!status) return <span className="text-[10px] text-muted-foreground">No application</span>;
    if (status === "approved") return <UserCheck className="h-3.5 w-3.5 text-green-600" />;
    if (status === "pending") return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    if (status === "rejected") return <UserX className="h-3.5 w-3.5 text-destructive" />;
    return null;
  };

  return (
    <>
      <Helmet><title>Registered Users — Admin — Maison Affluency</title></Helmet>

      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="font-display text-2xl text-foreground">Registered Users</h1>
              <p className="font-body text-sm text-muted-foreground mt-0.5">
                {search.trim()
                  ? `${filtered.length} of ${users.length} users`
                  : `All accounts that have signed up — ${users.length} total`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={recomputeAll}
              className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-body rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
            >
              Recompute tier suggestions
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, tier, month…"
                className="pl-8 pr-3 py-1.5 text-sm font-body rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 w-56"
              />
            </div>
          </div>
        </div>

        {/* Tier legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-body text-muted-foreground">
          <span className="uppercase tracking-wider">Trade tiers:</span>
          {TIER_OPTIONS.map((t) => (
            <span key={t} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${tierBadgeClass(t)}`}>
              <span className="font-medium">{TIER_LABEL[t]}</span>
              <span className="opacity-70">{Math.round(TIER_DISCOUNT[t] * 100)}%</span>
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">User</th>
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Company</th>
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Roles</th>
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Trade Tier</th>
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Suggested (12mo spend)</th>
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Application</th>
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-display text-sm text-foreground">
                          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : "—"}
                        </div>
                        <div className="font-body text-[11px] text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-foreground">{u.company || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length > 0 ? u.roles.map(roleBadge) : (
                            <span className="text-[10px] text-muted-foreground">none</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.trade_tier}
                          disabled={savingId === u.id}
                          onChange={(e) => updateTier(u.id, e.target.value as TradeTier)}
                          className={`text-[11px] font-body px-2 py-1 rounded border outline-none focus:ring-1 focus:ring-primary/30 ${tierBadgeClass(u.trade_tier)} ${savingId === u.id ? "opacity-50" : ""}`}
                        >
                          {TIER_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {TIER_LABEL[t]} — {Math.round(TIER_DISCOUNT[t] * 100)}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {u.trade_tier_suggested ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${tierBadgeClass(u.trade_tier_suggested)}`}>
                              {TIER_LABEL[u.trade_tier_suggested]}
                            </span>
                            <span className="font-body text-[11px] text-muted-foreground">{fmtEur(u.trade_tier_12mo_spend_cents)}</span>
                            {u.trade_tier_suggested !== u.trade_tier && (
                              <button
                                onClick={() => updateTier(u.id, u.trade_tier_suggested!)}
                                disabled={savingId === u.id}
                                className="text-[10px] uppercase tracking-wider text-primary hover:underline disabled:opacity-50"
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {appStatusIcon(u.app_status)}
                          {u.app_status && (
                            <span className="text-[11px] text-muted-foreground capitalize">{u.app_status}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-body text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(u.created_at), "d MMM yyyy")}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No users match "{search}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
