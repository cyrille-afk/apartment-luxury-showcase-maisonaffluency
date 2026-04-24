import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, ExternalLink, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ApplicationCardSkeleton } from "@/components/trade/skeletons";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TaxonomyAudit from "@/components/trade/TaxonomyAudit";
import HeroManager from "@/components/trade/HeroManager";
import SampleRequestsAdmin from "@/components/trade/SampleRequestsAdmin";
import ScrapeProducts from "@/components/trade/ScrapeProducts";
import InstagramFeedAdmin from "@/components/trade/InstagramFeedAdmin";
import OgRescrapeAdmin from "@/components/trade/OgRescrapeAdmin";
import { Link } from "react-router-dom";
import { Instagram, FileBox } from "lucide-react";

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

function InstagramAuditCard() {
  const { data: missingCount = 0 } = useQuery({
    queryKey: ["ig-missing-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designers")
        .select("slug, links")
        .eq("is_published", true);
      if (!data) return 0;
      return data.filter((d) => {
        const links = d.links as any[] | null;
        if (!links || !Array.isArray(links)) return true;
        return !links.some((l: any) => l.type === "Instagram" || l.type === "instagram");
      }).length;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Link
      to="/trade/designers/instagram"
      className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
    >
      <Instagram className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      <div className="flex-1">
        <span className="font-display text-sm text-foreground">Instagram Audit</span>
        <p className="font-body text-[10px] text-muted-foreground">Visual map of all designer IG accounts</p>
      </div>
      {missingCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground font-body text-[10px] font-medium">
          {missingCount}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}


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
    if (applicantEmail && action === "approved") {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "trade-approval",
            recipientEmail: applicantEmail,
            idempotencyKey: `trade-approval-${app.id}`,
            templateData: {
              name: applicantName,
              companyName: app.company_name,
            },
          },
        });
      } catch (err) {
        console.error("Failed to send approval email:", err);
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
      {/* Instagram Audit link */}
      <InstagramAuditCard />

      {/* CAD / 3D Assets manager */}
      <Link
        to="/trade/admin/cad-assets"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <FileBox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">CAD &amp; 3D Assets</span>
          <p className="font-body text-[10px] text-muted-foreground">Upload .dwg, .rfa, .skp files per product and variant for trade users</p>
        </div>
      </Link>

      <InstagramFeedAdmin />

      <TaxonomyAudit />

      {/* Section Hero Manager — collapsible */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 group cursor-pointer">
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          <h2 className="font-display text-lg text-foreground">Section Hero Images</h2>
        </CollapsibleTrigger>
        <p className="font-body text-xs text-muted-foreground ml-6">Upload custom hero banners for trade portal sections. Remove to revert to defaults.</p>
        <CollapsibleContent className="mt-3">
          <HeroManager />
        </CollapsibleContent>
      </Collapsible>

      {/* Scrape Products */}
      <ScrapeProducts />

      {/* OG Rescrape */}
      <OgRescrapeAdmin />

      {/* Sample Requests Manager */}
      <SampleRequestsAdmin />

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
