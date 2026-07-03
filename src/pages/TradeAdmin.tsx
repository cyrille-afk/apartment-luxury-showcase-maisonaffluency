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
import { Instagram, FileBox, Sparkles, Inbox, FileSpreadsheet, MapPin, AlertTriangle, ShieldCheck, Mail } from "lucide-react";

/**
 * Build a previewable verification checklist for the applicant. The items are
 * derived from the warn signals surfaced on the card so reviewers can request
 * exactly what's missing in one click and send it directly from the app.
 */
function buildChecklist(app: Application, signals: Signal[]): {
  to: string;
  firstName: string;
  subject: string;
  body: string;
  items: string[];
} | null {
  const email = app.profiles?.email;
  if (!email) return null;
  const firstName = app.profiles?.first_name || "there";
  const items: string[] = [];
  const warns = signals.filter((s) => s.kind === "warn");
  for (const s of warns) {
    if (s.label.startsWith("Personal email")) items.push("A corporate email address on your firm's domain (not gmail/yahoo/etc.).");
    else if (s.label.startsWith("Email domain ≠")) items.push("An email address on the same domain as your company website, or a note explaining the mismatch.");
    else if (s.label === "No company website") items.push("A link to your firm's website or an online portfolio (Instagram / Houzz / Behance are fine).");
    else if (s.label === "Cert claimed, no details") items.push("The name of your certifying body and your membership / registration number (e.g. RIBA, ASID, BIID, NCIDQ).");
    else if (s.label.startsWith("Generic title")) items.push("A specific job title describing your role (e.g. Interior Designer, Principal, Studio Director).");
    else if (s.label === "No introduction message") items.push("A short description of your practice and the type of projects you work on.");
  }
  if (items.length === 0) {
    items.push("A brief note confirming your role, your firm, and one or two recent projects so we can complete verification.");
  }
  const bulletList = items.map((i) => `  • ${i}`).join("\n");
  const subject = "Maison Affluency — completing your trade verification";
  const body =
    `Hello ${firstName},\n\n` +
    `Thank you for applying to Maison Affluency Trade. To finish verifying you as a professional, could you send us the following:\n\n` +
    `${bulletList}\n\n` +
    `[ Complete your application ]  ← secure one-time link, expires in 14 days\n` +
    `(A unique URL is generated when you click Send — the recipient can update their existing application without re-applying.)\n\n` +
    `Prefer email? Just reply to this message.\n\n` +
    `With thanks,\nMaison Affluency Trade Team`;
  return { to: email, firstName, subject, body, items };
}


// Free-email domains that don't tell us anything about the applicant's firm.
// A personal address on a trade application isn't disqualifying on its own,
// but combined with a missing website / generic job title it's the single
// strongest "please look closer" signal for admin reviewers.
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "live.com", "msn.com",
  "protonmail.com", "proton.me", "gmx.com", "gmx.net", "yandex.com",
  "mail.com", "zoho.com", "fastmail.com", "hey.com", "duck.com",
]);

// Job titles that carry no professional information — flag so the reviewer
// can request clarification before approving.
const GENERIC_TITLES = /^(employee|staff|worker|user|self|owner|manager|na|n\/a|-)$/i;

function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = input.includes("://") ? input : `https://${input}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

type Signal = { kind: "ok" | "warn"; label: string; hint: string };

/**
 * Compute the pro-verification signals shown on each application card.
 * `ok` badges are positive markers (corp email matches website, cert details
 * provided, etc.). `warn` badges highlight what the reviewer must chase down
 * before approving.
 */
function computeSignals(app: Application): Signal[] {
  const signals: Signal[] = [];
  const email = app.profiles?.email ?? null;
  const eDomain = emailDomain(email);
  const wDomain = extractDomain(app.company_website);

  if (eDomain && PERSONAL_EMAIL_DOMAINS.has(eDomain)) {
    signals.push({
      kind: "warn",
      label: `Personal email (${eDomain})`,
      hint: "Applicant used a free-mail address rather than a company domain.",
    });
  } else if (eDomain && wDomain) {
    // Corp email matches company website — the single strongest positive signal.
    const matches = eDomain === wDomain || eDomain.endsWith(`.${wDomain}`) || wDomain.endsWith(`.${eDomain}`);
    if (matches) {
      signals.push({
        kind: "ok",
        label: `Email matches ${wDomain}`,
        hint: "Corporate email domain matches the declared company website.",
      });
    } else {
      signals.push({
        kind: "warn",
        label: `Email domain ≠ website (${eDomain} vs ${wDomain})`,
        hint: "The email domain does not match the declared company website — verify manually.",
      });
    }
  }

  if (!app.company_website) {
    signals.push({
      kind: "warn",
      label: "No company website",
      hint: "No website was provided — nothing to verify the firm against.",
    });
  }

  if (app.is_certified_professional && !app.certification_details) {
    signals.push({
      kind: "warn",
      label: "Cert claimed, no details",
      hint: "Applicant ticked \"certified professional\" but left the certification body/number blank.",
    });
  } else if (app.certification_details) {
    signals.push({
      kind: "ok",
      label: "Cert details provided",
      hint: app.certification_details,
    });
  }

  if (GENERIC_TITLES.test(app.job_title.trim())) {
    signals.push({
      kind: "warn",
      label: `Generic title: "${app.job_title}"`,
      hint: "Job title is too generic to establish a professional role.",
    });
  }

  if (!app.message || app.message.trim().length < 20) {
    signals.push({
      kind: "warn",
      label: "No introduction message",
      hint: "Applicant didn't describe their practice or projects.",
    });
  }

  return signals;
}

/**
 * Roll the per-signal breakdown up into a single "Professional status"
 * verdict shown at the top of the card. The rules are intentionally
 * conservative — admins are still expected to click through — but they let a
 * reviewer triage a long queue at a glance:
 *
 *   verified  — corporate email matches website AND no warn signals.
 *   pro       — at least one ok signal (cert details OR matching corp email)
 *               AND no more than one warn signal.
 *   review    — mixed / thin: 1–3 warn signals and nothing conclusive.
 *   unverified— 4+ warn signals OR every signal is a warn (Julie's case).
 */
type ProStatus = "verified" | "pro" | "review" | "unverified";

function classifyProStatus(signals: Signal[]): {
  status: ProStatus;
  label: string;
  hint: string;
} {
  const warns = signals.filter((s) => s.kind === "warn");
  const oks = signals.filter((s) => s.kind === "ok");
  const emailMatchesWebsite = oks.some((s) => s.label.startsWith("Email matches "));
  const hasCertDetails = oks.some((s) => s.label === "Cert details provided");

  if (emailMatchesWebsite && warns.length === 0) {
    return {
      status: "verified",
      label: "Verified Pro",
      hint: "Corporate email matches company website and no red flags — safe to approve after a quick sanity check.",
    };
  }
  if ((emailMatchesWebsite || hasCertDetails) && warns.length <= 1) {
    return {
      status: "pro",
      label: "Likely Pro",
      hint: "Strong professional signal present but one soft flag to confirm.",
    };
  }
  if (warns.length >= 4 || (oks.length === 0 && warns.length > 0)) {
    return {
      status: "unverified",
      label: "Unverified",
      hint: "No professional signal on file — request website, portfolio, or credentials before approving.",
    };
  }
  return {
    status: "review",
    label: "Needs Review",
    hint: "Mixed signals — inspect the details below before approving or rejecting.",
  };
}


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
  verification_checklist_sent_at: string | null;
  verification_checklist_sent_by: string | null;
  verification_checklist_sent_by_name: string | null;
  edit_completed_at: string | null;
  edit_completed_by_name: string | null;
  profiles?: { first_name: string; last_name: string; email: string } | null;
}

const TradeAdmin = () => {
  const { isAdmin, isSuperAdmin, loading, user } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [confirmDialog, setConfirmDialog] = useState<{ app: Application; action: "approved" | "rejected" } | null>(null);
  const [sendingChecklist, setSendingChecklist] = useState(false);
  const [checklistPreview, setChecklistPreview] = useState<{
    app: Application;
    to: string;
    firstName: string;
    subject: string;
    body: string;
    items: string[];
  } | null>(null);
  const [adminProfile, setAdminProfile] = useState<{ first_name: string; last_name: string; email: string } | null>(null);

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
    if (user?.id) {
      supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setAdminProfile(data as any);
        });
    }
  }, [isAdmin, filter, user?.id]);

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
      {/* Concierge Leads */}
      <Link
        to="/trade/admin/concierge-leads"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <Inbox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">Concierge Leads</span>
          <p className="font-body text-[10px] text-muted-foreground">Browse and filter AI-captured lead intake from public and trade concierge</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>

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

      {/* 3D Models (GLB) uploader */}
      <Link
        to="/trade/admin/glb-models"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <FileBox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">3D Models (GLB)</span>
          <p className="font-body text-[10px] text-muted-foreground">Upload a .glb/.gltf to a product — auto-saves the URL and shows the interactive viewer on the trade page</p>
        </div>
      </Link>

      {/* Hotspot → catalog bulk mapping */}
      <Link
        to="/trade/admin/hotspot-mapping"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <MapPin className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">Hotspot → Catalog Mapping</span>
          <p className="font-body text-[10px] text-muted-foreground">Bulk-assign exact catalog picks to gallery hotspots and override the View Product fuzzy matcher</p>
        </div>
      </Link>

      {/* Onboarding flow editor */}
      <Link
        to="/trade/admin/onboarding"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">First-login flow</span>
          <p className="font-body text-[10px] text-muted-foreground">Edit the welcome panel, Quick Tour steps, and replay onboarding for any user</p>
        </div>
      </Link>

      {/* Onboarding funnel analytics */}
      <Link
        to="/trade/admin/onboarding-funnel"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">Onboarding funnel</span>
          <p className="font-body text-[10px] text-muted-foreground">Step views, sub-step clicks, completes and skips — filterable by device</p>
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
          {applications.map((app) => {
            // Compute once per card so both the header pro-badge and the
            // signals row below stay in sync.
            const signals = computeSignals(app);
            const pro = classifyProStatus(signals);
            const proStyles: Record<ProStatus, string> = {
              verified: "border-success/40 bg-success/10 text-success",
              pro: "border-success/40 bg-success/5 text-success",
              review: "border-warning/40 bg-warning/10 text-warning",
              unverified: "border-destructive/40 bg-destructive/10 text-destructive",
            };
            const ProIcon = pro.status === "unverified" ? AlertTriangle : ShieldCheck;
            return (
            <div key={app.id} className="border border-border rounded-lg p-5">

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h3 className="font-display text-base text-foreground">{app.company_name}</h3>
                    <span
                      title={pro.hint}
                      aria-label={`Professional status: ${pro.label}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider border ${proStyles[pro.status]}`}
                    >
                      <ProIcon className="h-3 w-3" />
                      {pro.label}
                    </span>
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
                  {(() => {
                    const warnCount = signals.filter((s) => s.kind === "warn").length;

                    return (
                      <div
                        className="mt-3 flex flex-wrap items-center gap-1.5"
                        aria-label={`Verification signals: ${warnCount} to review`}
                      >
                        <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground/70 mr-1">
                          Signals
                        </span>
                        {signals.map((s, i) => (
                          <span
                            key={i}
                            title={s.hint}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] ${
                              s.kind === "warn"
                                ? "border-warning/40 bg-warning/10 text-warning"
                                : "border-success/40 bg-success/10 text-success"
                            }`}
                          >
                            {s.kind === "warn" ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            {s.label}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  <p className="font-body text-[10px] text-muted-foreground/60 mt-2">
                    Applied {new Date(app.created_at).toLocaleDateString()}
                  </p>
                  {app.verification_checklist_sent_at && (
                    <p className="font-body text-[10px] text-success mt-1">
                      Checklist sent
                      {app.verification_checklist_sent_by_name ? ` by ${app.verification_checklist_sent_by_name}` : ""}
                      {" "}{new Date(app.verification_checklist_sent_at).toLocaleDateString()}
                    </p>
                  )}
                  {app.edit_completed_at && (
                    <p className="font-body text-[10px] text-primary mt-0.5">
                      ✓ Completed
                      {app.edit_completed_by_name ? ` by ${app.edit_completed_by_name}` : ""}
                      {" on "}
                      {new Date(app.edit_completed_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>


                {app.status === "pending" && isSuperAdmin && (
                  <div className="flex gap-2 shrink-0">
                    {(() => {
                      const c = buildChecklist(app, signals);
                      return c ? (
                        <button
                          type="button"
                          onClick={() => setChecklistPreview({ app, ...c })}
                          className={`p-2 rounded-full border transition-colors ${
                            app.verification_checklist_sent_at
                              ? "border-success/30 text-success hover:bg-success/10"
                              : "border-primary/30 text-primary hover:bg-primary/10"
                          }`}
                          title={app.verification_checklist_sent_at ? "Resend verification checklist" : "Preview verification checklist email"}
                          aria-label={app.verification_checklist_sent_at ? "Resend verification checklist" : "Preview verification checklist"}
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      ) : null;
                    })()}
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
          );})}

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

      <AlertDialog open={!!checklistPreview} onOpenChange={(open) => !open && setChecklistPreview(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Verification checklist preview</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-xs">
              Review before sending. The checklist is delivered directly from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {checklistPreview && (
            <div className="space-y-3 font-body text-xs">
              <div className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">To</span>
                <span className="text-foreground break-all">{checklistPreview.to}</span>
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Subject</span>
                <span className="text-foreground">{checklistPreview.subject}</span>
              </div>
              <div className="rounded border border-border bg-muted/30 p-3 max-h-[50vh] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-body text-xs text-foreground leading-relaxed">
{checklistPreview.body}
                </pre>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                {checklistPreview.items.length} item{checklistPreview.items.length === 1 ? "" : "s"} requested · applicant: {checklistPreview.app.company_name}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body text-xs" disabled={sendingChecklist}>Cancel</AlertDialogCancel>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 font-body text-xs text-primary-foreground shadow hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              disabled={sendingChecklist}
              onClick={async () => {
                if (!checklistPreview) return;
                setSendingChecklist(true);
                try {
                  // Generate a high-entropy one-time edit token. The raw token is only
                  // sent by email; the DB stores only its SHA-256 hash so a DB read
                  // cannot reveal the link.
                  const rawBytes = new Uint8Array(32);
                  crypto.getRandomValues(rawBytes);
                  const editToken = Array.from(rawBytes)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
                  const hashBuf = await crypto.subtle.digest(
                    "SHA-256",
                    new TextEncoder().encode(editToken)
                  );
                  const editTokenHash = Array.from(new Uint8Array(hashBuf))
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
                  const editExpiresAt = new Date(
                    Date.now() + 14 * 24 * 60 * 60 * 1000
                  ).toISOString();
                  const editUrl = `${window.location.origin}/trade/apply/complete/${editToken}`;

                  const { error: tokenErr } = await supabase
                    .from("trade_applications")
                    .update({
                      edit_token_hash: editTokenHash,
                      edit_token_expires_at: editExpiresAt,
                    })
                    .eq("id", checklistPreview.app.id);
                  if (tokenErr) throw tokenErr;

                  const { data, error } = await supabase.functions.invoke("send-transactional-email", {
                    body: {
                      templateName: "trade-verification-checklist",
                      recipientEmail: checklistPreview.to,
                      idempotencyKey: `trade-checklist-${checklistPreview.app.id}-${Date.now()}`,
                      templateData: {
                        firstName: checklistPreview.firstName,
                        items: checklistPreview.items,
                        editUrl,
                      },
                    },
                  });
                  if (error) throw error;
                  if (data && data.success === false) {
                    throw new Error(data.reason || "Send failed");
                  }
                  const sentAt = new Date().toISOString();
                  const sentByName = adminProfile
                    ? `${adminProfile.first_name || ""} ${adminProfile.last_name || ""}`.trim() || adminProfile.email
                    : user?.email || "";
                  const { error: updateError } = await supabase
                    .from("trade_applications")
                    .update({
                      verification_checklist_sent_at: sentAt,
                      verification_checklist_sent_by: user?.id,
                      verification_checklist_sent_by_name: sentByName,
                    })
                    .eq("id", checklistPreview.app.id);
                  if (updateError) throw updateError;
                  setApplications((prev) =>
                    prev.map((a) =>
                      a.id === checklistPreview.app.id
                        ? {
                            ...a,
                            verification_checklist_sent_at: sentAt,
                            verification_checklist_sent_by: user?.id ?? null,
                            verification_checklist_sent_by_name: sentByName || null,
                          }
                        : a
                    )
                  );
                  toast({
                    title: "Checklist sent",
                    description: `Emailed ${checklistPreview.to} with a secure edit link. Replies go to concierge@myaffluency.com.`,
                  });
                  setChecklistPreview(null);
                } catch (e: any) {
                  console.error("[send-checklist]", e);
                  toast({
                    title: "Send failed",
                    description: e?.message || "Could not send the checklist. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setSendingChecklist(false);
                }
              }}
            >
              {sendingChecklist ? "Sending…" : checklistPreview?.app.verification_checklist_sent_at ? "Resend checklist" : "Send now"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TradeAdmin;
