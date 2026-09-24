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
import { Link } from "react-router-dom";
import { Inbox, AlertTriangle, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";


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
  instagram_handle: string | null;
  tax_vat_id: string | null;
  credential_document_path: string | null;
  tax_exempt_status: boolean;
  verification_notes: string | null;
  ai_confidence: number | null;
  ai_verified_at: string | null;
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
  const [filter, setFilter] = useState<"pending" | "flagged_for_review" | "system_retry" | "approved" | "rejected" | "all">("pending");
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
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [renderingHtml, setRenderingHtml] = useState(false);
  const [applicationEmailPreviewOpen, setApplicationEmailPreviewOpen] = useState(false);
  const [applicationEmailPreview, setApplicationEmailPreview] = useState<{ html: string; subject: string } | null>(null);
  const [applicationEmailPreviewLoading, setApplicationEmailPreviewLoading] = useState(false);

  const openApplicationEmailPreview = async () => {
    setApplicationEmailPreviewOpen(true);
    setApplicationEmailPreview(null);
    setApplicationEmailPreviewLoading(true);
    const { data, error } = await supabase.functions.invoke("render-email-preview", {
      body: { templateName: "trade-program-invitation" },
    });
    setApplicationEmailPreviewLoading(false);
    if (error || !(data as { html?: string })?.html) {
      toast({
        title: "Preview unavailable",
        description: error?.message || "The application email could not be rendered.",
        variant: "destructive",
      });
      return;
    }
    setApplicationEmailPreview(data as { html: string; subject: string });
  };

  // Render the actual React Email HTML (with the styled CTA button) whenever the
  // preview dialog opens. Uses a sample edit URL — the real token is minted on Send.
  useEffect(() => {
    if (!checklistPreview) {
      setRenderedHtml(null);
      return;
    }
    let alive = true;
    setRenderingHtml(true);
    setRenderedHtml(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke("render-email-preview", {
        body: {
          templateName: "trade-verification-checklist",
          templateData: {
            firstName: checklistPreview.firstName,
            items: checklistPreview.items,
            editUrl: `${window.location.origin}/trade/apply/complete/preview-token`,
          },
        },
      });
      if (!alive) return;
      setRenderingHtml(false);
      if (!error && (data as { html?: string })?.html) {
        setRenderedHtml((data as { html: string }).html);
      }
    })();
    return () => {
      alive = false;
    };
  }, [checklistPreview]);





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
    // Legacy list retired — applications live in Inbound Applications.
    setApplications([]);
    setFetching(false);
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Admin — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-5xl space-y-6">
      {/* Inquiries Inbox — Price upon Request + concierge + contact form */}
      <Link
        to="/trade/admin/inquiries"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <Inbox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">Inquiries Inbox</span>
          <p className="font-body text-[10px] text-muted-foreground">Review Price-upon-Request submissions, concierge chat leads, and contact-form messages. Draft a quote from each and mark it ready to send.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>

      <Link
        to="/trade/admin/collector-applications"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <Inbox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">Collector Applications</span>
          <p className="font-body text-[10px] text-muted-foreground">Review, approve, or reject private collector applications. Approval grants access to gated pricing and full provenance.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>

      <Link
        to="/trade/admin/portal-invites"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <Inbox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">China Portal Invites</span>
          <p className="font-body text-[10px] text-muted-foreground">Issue single-use or campaign invitation codes for the /cn invite-only portal. Track usage and revoke access.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>




      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-foreground">Trade Applications</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={openApplicationEmailPreview}>
          <Mail className="h-4 w-4" />
          Preview application email
        </Button>
      </div>

      <Link
        to="/trade/admin/trade-applications"
        className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
      >
        <Inbox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex-1">
          <span className="font-display text-sm text-foreground">Inbound Applications</span>
          <p className="font-body text-[10px] text-muted-foreground">All trade applications from every entry point now arrive in one queue, with Turnstile check, AI radar and visual analysis.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>
    </div>

      <AlertDialog open={applicationEmailPreviewOpen} onOpenChange={setApplicationEmailPreviewOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Trade Program application email</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-xs">
              This is the registered production email with safe sample details. Previewing does not send it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {applicationEmailPreviewLoading && (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">Rendering email…</div>
          )}
          {!applicationEmailPreviewLoading && applicationEmailPreview && (
            <div className="space-y-3">
              <div className="grid grid-cols-[64px_1fr] gap-3 font-body text-xs">
                <span className="text-[10px] uppercase text-muted-foreground">Subject</span>
                <span className="text-foreground">{applicationEmailPreview.subject}</span>
              </div>
              <div className="overflow-hidden rounded border border-border bg-background">
                <iframe
                  title="Trade Program application email preview"
                  srcDoc={applicationEmailPreview.html}
                  className="h-[62vh] w-full border-0 bg-background"
                  sandbox=""
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TradeAdmin;
