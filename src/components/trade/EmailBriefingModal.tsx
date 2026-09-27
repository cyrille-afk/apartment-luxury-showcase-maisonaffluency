/**
 * Email Private Briefing Workspace — manual send of the founder letter (same copy as the
 * automated campaign in dispatch-acquisition-campaign), with a tracked onboarding link.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { buildOutreachLink } from "@/lib/outreachLink";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  studioName: string;
  founderName: string | null;
  email: string | null;
  onSent?: () => void;
};

const directorName = (founder: string | null, studio: string) => {
  const c = (founder ?? "").trim();
  return !c || /\b(?:director|group)\b/i.test(c) ? { name: `Team at ${studio}`, personal: false } : { name: c, personal: true };
};

const buildBody = (director: string, company: string, link: string) => `Dear ${director},

In managing a global design portfolio of ${company}’s caliber, the primary bottlenecks in scaling your project pipelines rarely stem from creative vision—they lie heavily in the friction of administrative procurement.

Between volatile international manufacturer lead times, cross-border logistics calculations, and the operational vulnerability of exposing trade margins during live client presentations, elite firms have long lacked a unified, enterprise-grade operating ledger.

Today, we are formally extending a private, verified Trade credential to your executive partners for the global launch of the Maison Affluency Trade Program.

We have centralized premium net pricing structures, cross-border shipping configurations, and dynamic lead-time telemetry for the world's most distinguished artisan workshops and collectible design houses into a single, automated curatorial architecture.

For ${company}, this provides an immediate operational shift:
1. Executive White-Label Control: With a single toggle, completely strip our platform identity and embed your own studio logo across the entire workspace interface, allowing you to pitch major architectural proposals entirely under your own agency's visual authority.
2. Isolated Client Presentations: Invite high-net-worth clients to explore fluid 3D material libraries and configure finishes in real time via a secure, read-only portal that completely sanitizes and hides your wholesale trade costs, internal markups, and vendor origins.
3. Automated Sourcing Integrity: Type complex project criteria directly into our specialized curatorial engine to instantly generate fully itemized, contract-ready specification matrices in seconds.

Because we enforce absolute structural data accuracy and dedicated server performance for our partner firms, initial enterprise allocations are restricted to 20 anchor global studios.

Your studio’s unique onboarding token and priority access gateway have been initialized here:

🔗 Bespoke Onboarding Access Key: ${link}

We look forward to establishing an elite procurement standard for your global teams.

Warm regards,

Cyrille Delval
Founder & Managing Director, Maison Affluency
Singapore, District 9 | concierge@myaffluency.com`;

const EmailBriefingModal = ({ open, onOpenChange, leadId, studioName, founderName, email, onSent }: Props) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const director = useMemo(() => directorName(founderName, studioName), [founderName, studioName]);
  const subject = `Private Briefing: Digital Sourcing Sovereign Ledger for ${studioName}`;
  const link = useMemo(() => buildOutreachLink({ channel: "email", hook: "A", agentId: user?.id, leadId }), [user?.id, leadId]);
  const body = useMemo(() => buildBody(director.name, studioName, link), [director.name, studioName, link]);

  const copy = async () => {
    const text = `Subject: ${subject}\n\n${body}`;
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    toast.success("Briefing copied to clipboard.");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openMail = () => {
    if (!email) return;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onSent?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Maison Affluency — Private Briefing Email Workspace</DialogTitle>
          <DialogDescription>{studioName} · {email ?? "No email on file"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resolved salutation</span>
            <span className={`text-[10px] uppercase tracking-[0.12em] ${director.personal ? "text-emerald-600" : "text-amber-600"}`}>
              {director.personal ? "Personal" : "Generic fallback"}
            </span>
          </div>
          <p className="font-serif text-lg text-foreground">Dear {director.name},</p>
        </div>

        <div className="border border-border bg-muted/20 px-5 py-3 text-sm">
          <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Subject</span>
          <span className="text-foreground">{subject}</span>
        </div>

        <div className="whitespace-pre-wrap border border-border bg-muted/20 p-5 text-sm leading-relaxed text-foreground">{body}</div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={copy} className="h-11 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Email Text"}
          </Button>
          <Button type="button" variant="outline" onClick={openMail} disabled={!email} className="h-11 gap-2">
            <Mail className="h-4 w-4" />
            {email ? "Open in Mail" : "No email on file"}
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailBriefingModal;
