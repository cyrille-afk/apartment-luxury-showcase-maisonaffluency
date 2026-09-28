import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const STATUSES = ["new", "contacted", "in_progress", "closed"];

export default function TradeAdminServiceRequests() {
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["trade-service-requests"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_service_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!loading && (!user || !isAdmin)) return <Navigate to="/trade" replace />;

  const setStatus = async (id: string, status: string) => {
    await supabase.from("trade_service_requests").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["trade-service-requests"] });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl uppercase tracking-[0.04em] text-foreground">Trade Services Requests</h1>
      <p className="mt-2 font-body text-sm text-muted-foreground">Newest first · {data.length} total</p>
      <div className="mt-8 overflow-x-auto border border-border">
        <table className="w-full font-body text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <tr>
              {["Received", "Name", "Company", "Service", "Country", "Contact", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-muted-foreground">Loading…</td></tr>}
            {!isLoading && data.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-muted-foreground">No requests yet.</td></tr>}
            {data.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-foreground">{r.first_name} {r.last_name}</td>
                <td className="px-4 py-3">{r.company_name}<div className="text-xs text-muted-foreground">{r.postal_code}</div></td>
                <td className="px-4 py-3">{r.service_type}</td>
                <td className="px-4 py-3">{r.country}</td>
                <td className="px-4 py-3">
                  <div className="text-xs text-muted-foreground">Prefers {r.preferred_contact}</div>
                  <a href={`mailto:${r.email}`} className="underline underline-offset-2">{r.email}</a>
                  <div>{r.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="border border-border bg-background px-2 py-1 text-xs uppercase tracking-wider">
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
