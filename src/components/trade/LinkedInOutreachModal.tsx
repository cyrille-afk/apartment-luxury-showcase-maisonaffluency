/**
 * LinkedIn Premium Outreach Workspace — same layout as the B2B/Instagram workspaces.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Linkedin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { resolveGreeting } from "./InstagramOutreachModal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studioName: string;
  founderName: string | null;
  linkedinUrl: string | null;
  onLaunched?: () => void;
};

const buildScript = (tab: "A" | "B", name: string | null, company: string) => {
  const hi = name ? `Hi ${name},` : "Hi there,";
  return tab === "A"
    ? `${hi} beautiful execution on your recent projects. We just launched Maison Affluency—a digital sourcing architecture built specifically for elite firms like ${company}. We’ve centralized priority net pricing, accurate global lead times, and shipping logistics for world-class artisan collections into a single, automated workspace to eliminate manual quoting delays. We'd love to fast-track your team with premium international trade status. Would you like us to drop a secure access credential key to your team's inbox?`
    : `${hi} exceptional portfolio curation. We recently launched the Maison Affluency Trade Program, engineered specifically to streamline client presentations for enterprise firms like ${company}. The platform allows your team to curate fluid material boards and instantly switch on a pristine Client Mode—fully white-labeling the interface with your own studio logo while completely locking away your trade costs and margins from external guests. We'd love to set up a private sandbox credential for your design partners. Should I pass an onboarding token to your inbox?`;
};

const LinkedInOutreachModal = ({ open, onOpenChange, studioName, founderName, linkedinUrl, onLaunched }: Props) => {
  const [tab, setTab] = useState<"A" | "B">("A");
  const [copied, setCopied] = useState(false);
  const { greetingName } = useMemo(() => resolveGreeting(founderName, studioName), [founderName, studioName]);
  const script = useMemo(() => buildScript(tab, greetingName, studioName), [tab, greetingName, studioName]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(script); } catch {
      const ta = document.createElement("textarea"); ta.value = script; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    toast.success("Personalised message copied to clipboard.");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const launch = () => {
    if (!linkedinUrl) return;
    window.open(linkedinUrl, "_blank", "noopener,noreferrer");
    onLaunched?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Maison Affluency — LinkedIn Premium Outreach Workspace</DialogTitle>
          <DialogDescription>{studioName} · LinkedIn Workspace</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {(["A", "B"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setTab(v)}
              className={`h-9 flex-1 border px-4 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                tab === v ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
              {v === "A" ? "A · System Speed Hook" : "B · Revenue Preservation Hook"}
            </button>
          ))}
        </div>

        <div className="space-y-2 border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resolved salutation</span>
            <span className={`text-[10px] uppercase tracking-[0.12em] ${greetingName ? "text-emerald-600" : "text-amber-600"}`}>
              {greetingName ? "Personal" : "Generic fallback"}
            </span>
          </div>
          <p className="font-serif text-lg text-foreground">{greetingName ? `Hi ${greetingName},` : "Hi there,"}</p>
          <p className="text-xs text-muted-foreground">
            {greetingName
              ? `Greeting will use "${greetingName}" from the active lead data field.`
              : "No personal first name in the lead's contact field, so the generic greeting is used."}
          </p>
        </div>

        <div className="whitespace-pre-wrap border border-border bg-muted/20 p-5 text-sm leading-relaxed text-foreground">{script}</div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={copy} className="h-11 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Message Text"}
          </Button>
          <Button type="button" variant="outline" onClick={launch} disabled={!linkedinUrl} className="h-11 gap-2">
            <Linkedin className="h-4 w-4" />
            {linkedinUrl ? "Launch LinkedIn Profile" : "No LinkedIn URL on file"}
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkedInOutreachModal;
