import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, ExternalLink } from "lucide-react";

interface Application {
  id: string;
  user_id: string;
  company_name: string;
  company_website: string | null;
  job_title: string;
  country: string;
  city: string;
  is_certified_professional: boolean;
  certification_details: string | null;
  message: string | null;
  status: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string; email: string } | null;
}

const TradeAdmin = () => {
  const { isAdmin, loading, user } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  useEffect(() => {
    if (!isAdmin) return;
    fetchApplications();
  }, [isAdmin, filter]);

  const fetchApplications = async () => {
    setFetching(true);
    let query = supabase.from("trade_applications").select("*, profiles!trade_applications_user_id_fkey(first_name, last_name, email)").order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    const { data } = await query;
    setApplications((data as any[]) || []);
    setFetching(false);
  };

  const handleAction = async (appId: string, userId: string, action: "approved" | "rejected") => {
    // Update application status
    await supabase.from("trade_applications").update({
      status: action,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    }).eq("id", appId);

    // If approved, add trade_user role
    if (action === "approved") {
      await supabase.from("user_roles").upsert({
        user_id: userId,
        role: "trade_user" as any,
      }, { onConflict: "user_id,role" });
    }

    // If rejected, remove trade_user role if it exists
    if (action === "rejected") {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "trade_user" as any);
    }

    toast({ title: `Application ${action}` });
    fetchApplications();
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Admin — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-foreground mb-6">Trade Applications</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full font-body text-xs uppercase tracking-[0.1em] border transition-colors ${
              filter === f
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : applications.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground py-8 text-center">No {filter} applications.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display text-base text-foreground">{app.company_name}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${
                      app.status === "pending" ? "bg-warning/10 text-warning" :
                      app.status === "approved" ? "bg-success/10 text-success" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {app.status === "pending" && <Clock className="h-3 w-3" />}
                      {app.status === "approved" && <Check className="h-3 w-3" />}
                      {app.status === "rejected" && <X className="h-3 w-3" />}
                      {app.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 font-body text-xs text-muted-foreground">
                    <span>Title: {app.job_title}</span>
                    <span>Location: {app.city ? `${app.city}, ` : ""}{app.country}</span>
                    <span>Certified: {app.is_certified_professional ? "Yes" : "No"}</span>
                    {app.company_website && (
                      <a href={app.company_website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-foreground hover:underline">
                        Website <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {app.certification_details && (
                    <p className="font-body text-xs text-muted-foreground mt-1">Cert: {app.certification_details}</p>
                  )}
                  {app.message && (
                    <p className="font-body text-xs text-muted-foreground mt-2 italic">"{app.message}"</p>
                  )}
                  <p className="font-body text-[10px] text-muted-foreground/60 mt-2">
                    Applied {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>

                {app.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(app.id, app.user_id, "approved")}
                      className="p-2 rounded-full border border-success/30 text-success hover:bg-success/10 transition-colors"
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleAction(app.id, app.user_id, "rejected")}
                      className="p-2 rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                      title="Reject"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
};

export default TradeAdmin;
