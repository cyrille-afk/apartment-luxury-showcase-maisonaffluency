import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, UserCheck, UserX, Clock, Shield } from "lucide-react";
import { Link } from "react-router-dom";

interface RegisteredUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  created_at: string;
  roles: string[];
  app_status: string | null;
}

export default function TradeRegisteredUsers() {
  const { isAdmin, loading } = useAuth();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-registered-users"],
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, company, created_at")
        .order("created_at", { ascending: false });

      if (error || !profiles) return [];

      // Fetch roles and applications in parallel
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

      // Only keep latest application per user
      const appMap = new Map<string, string>();
      (appsRes.data || []).forEach((a: any) => {
        if (!appMap.has(a.user_id)) appMap.set(a.user_id, a.status);
      });

      return profiles.map((p): RegisteredUser => ({
        ...p,
        roles: rolesMap.get(p.id) || [],
        app_status: appMap.get(p.id) || null,
      }));
    },
    enabled: isAdmin,
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

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
        <div className="flex items-center gap-3">
          <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-foreground">Registered Users</h1>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              All accounts that have signed up — {users.length} total
            </p>
          </div>
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
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Application</th>
                    <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
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
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
