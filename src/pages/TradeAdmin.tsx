import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, ExternalLink } from "lucide-react";
import { ApplicationCardSkeleton } from "@/components/trade/skeletons";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TaxonomyAudit from "@/components/trade/TaxonomyAudit";

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
  const { isAdmin, isSuperAdmin, loading, user } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [confirmDialog, setConfirmDialog] = useState<{ app: Application; action: "approved" | "rejected" } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchApplications();
  }, [isAdmin, filter]);

  const fetchApplications = async () => {
    setFetching(true);
    let query = supabase.from("trade_applications").select("*").order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    const { data } = await query;
    const apps = (data as any[]) || [];

    // Fetch profiles for all applicant user_ids
    const userIds = [...new Set(apps.map((a) => a.user_id))];
    let profileMap: Record<string, { first_name: string; last_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", userIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
      }
    }

    setApplications(apps.map((a) => ({ ...a, profiles: profileMap[a.user_id] || null })));
    setFetching(false);
  };

  const handleAction = async (app: Application, action: "approved" | "rejected") => {
    // Update application status
    await supabase.from("trade_applications").update({
      status: action,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    }).eq("id", app.id);

    // If approved, add trade_user role
    if (action === "approved") {
      await supabase.from("user_roles").upsert({
        user_id: app.user_id,
        role: "trade_user" as any,
      }, { onConflict: "user_id,role" });
    }

    // If rejected, remove trade_user role if it exists
    if (action === "rejected") {
      await supabase.from("user_roles").delete().eq("user_id", app.user_id).eq("role", "trade_user" as any);
    }

    // Send email notification to applicant
    const applicantEmail = app.profiles?.email;
    const applicantName = app.profiles ? `${app.profiles.first_name} ${app.profiles.last_name}`.trim() : "";
    if (applicantEmail) {
      try {
        await supabase.functions.invoke("send-application-status", {
          body: {
            applicantEmail,
            applicantName,
            companyName: app.company_name,
            status: action,
          },
        });
      } catch (err) {
        console.error("Failed to send status email:", err);
      }
    }

    toast({ title: `Application ${action}` });
    fetchApplications();
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Admin — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-5xl space-y-6">
      <TaxonomyAudit />
      <h1 className="font-display text-2xl text-foreground">Trade Applications</h1>

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
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <ApplicationCardSkeleton key={i} />)}
        </div>
      ) : applications.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground py-8 text-center">No {filter} applications.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
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
                  {app.profiles && (
                    <p className="font-body text-xs text-muted-foreground mb-2">
                      {app.profiles.first_name} {app.profiles.last_name} · <a href={`mailto:${app.profiles.email}`} className="text-foreground hover:underline">{app.profiles.email}</a>
                    </p>
                  )}
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

                {app.status === "pending" && isSuperAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmDialog({ app, action: "approved" })}
                      className="p-2 rounded-full border border-success/30 text-success hover:bg-success/10 transition-colors"
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDialog({ app, action: "rejected" })}
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

      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {confirmDialog?.action === "approved" ? "Approve" : "Reject"} Application
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Are you sure you want to {confirmDialog?.action === "approved" ? "approve" : "reject"} the application from{" "}
              <span className="font-medium text-foreground">{confirmDialog?.app.company_name}</span>?
              {confirmDialog?.action === "approved"
                ? " This will grant them trade portal access."
                : " This will revoke their trade portal access if previously granted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={`font-body text-xs ${
                confirmDialog?.action === "rejected"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }`}
              onClick={() => {
                if (confirmDialog) handleAction(confirmDialog.app, confirmDialog.action);
                setConfirmDialog(null);
              }}
            >
              {confirmDialog?.action === "approved" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TradeAdmin;
