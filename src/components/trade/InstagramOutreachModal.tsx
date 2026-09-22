/**
 * Instagram Premium Outreach Workspace.
 *
 * Generates a copy-optimised DM script from live row metadata, with two
 * tone variations, clipboard copy and a deep link to the studio profile.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Instagram } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studioName: string;
  founderName: string | null;
  instagramHandle: string;
  designerMatches: string[];
  onLaunched: () => void;
};

const GENERIC_CONTACT = /^(team|studio|info|office|admin|contact|director|principal|hello)\b/i;

export const firstNameOrThere = (founderName: string | null): string => {
  const raw = (founderName ?? "").trim();
  if (!raw) return "there";
  // Multiple principals: "Jane Doe & John Smith" -> "Jane & John"
  const people = raw.split(/\s*(?:&|,| and )\s*/i).filter(Boolean);
  const firsts = people
    .map((p) => p.trim().split(/\s+/)[0] ?? "")
    .filter((n) => n && !GENERIC_CONTACT.test(n));
  if (firsts.length === 0) return "there";
  if (firsts.length === 1) return firsts[0];
  return `${firsts.slice(0, -1).join(", ")} & ${firsts[firsts.length - 1]}`;
};

export const brandPhrase = (matches: string[]): string => {
  const picked = matches.map((m) => m.trim()).filter(Boolean).slice(0, 2);
  if (picked.length === 0) return "elite global design houses";
  if (picked.length === 1) return picked[0];
  return `${picked[0]} and ${picked[1]}`;
};

const buildScript = (
  variation: "A" | "B",
  founderOrTeam: string,
  studioName: string,
  designerBrands: string,
) =>
  variation === "A"
    ? `Hi ${founderOrTeam}, beautiful execution on your recent projects. We just launched Maison Affluency—a digital sourcing architecture built specifically for elite firms like ${studioName}. We’ve centralized priority net pricing for collections like ${designerBrands} into a single interface to eliminate manual quoting delays. We'd love to fast-track your team with premium international trade status. Would you like us to drop an access credential key to your team's inbox?`
    : `Hello ${founderOrTeam}, your studio's curation style caught our eye, particularly how you incorporate pieces from creators like ${designerBrands} into your workspaces. We operate Maison Affluency, a closed-network trade sourcing platform for AD100 caliber studios. We provide streamlined global invoicing and real-time net logistics. If you're open to exploring a cleaner sourcing workflow for your next project, let us know your preferred email and we’ll issue a private onboarding key.`;

const InstagramOutreachModal = ({
  open,
  onOpenChange,
  studioName,
  founderName,
  instagramHandle,
  designerMatches,
  onLaunched,
}: Props) => {
  const [variation, setVariation] = useState<"A" | "B">("A");
  const [copied, setCopied] = useState(false);

  const handle = instagramHandle.replace(/^@+/, "").trim();
  const founderOrTeam = useMemo(() => firstNameOrThere(founderName), [founderName]);
  const designerBrands = useMemo(() => brandPhrase(designerMatches), [designerMatches]);
  const script = useMemo(
    () => buildScript(variation, founderOrTeam, studioName, designerBrands),
    [variation, founderOrTeam, studioName, designerBrands],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = script;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast.success("Copied!", { icon: <Check className="h-4 w-4" /> });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const launch = () => {
    window.open(`https://instagram.com/${handle}`, "_blank", "noopener,noreferrer");
    onLaunched();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Instagram Premium Outreach Workspace
          </DialogTitle>
          <DialogDescription>
            {studioName} · @{handle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {(["A", "B"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariation(v)}
              className={`h-9 flex-1 border px-4 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                variation === v
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {v === "A" ? "A · Project Sourcing" : "B · Portfolio Appreciation"}
            </button>
          ))}
        </div>

        <div className="whitespace-pre-wrap border border-border bg-muted/20 p-5 text-sm leading-relaxed text-foreground">
          {script}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={copy} className="h-11 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Message Text"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={launch}
            className="h-11 gap-2 border-[#C13584]/50 text-[#C13584] hover:bg-[#C13584] hover:text-white"
          >
            <Instagram className="h-4 w-4" />
            Launch Instagram Profile
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstagramOutreachModal;
