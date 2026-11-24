import { useState } from "react";
import { ArrowRight, Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import affluencyLogo from "@/assets/affluency-logo-full.jpeg";

export const VIEWING_ROOM_CONTACT_EMAIL = "concierge@maisonaffluency.com";

const copy: Record<"expired" | "revoked", { title: string; body: string }> = {
  expired: {
    title: "Your private viewing has ended",
    body: "The access period for this viewing room has come to a close. Our team would be delighted to reopen it for you — simply reach out and we will send a renewed invitation.",
  },
  revoked: {
    title: "This invitation is no longer active",
    body: "Access to this viewing room has been withdrawn. If you believe this is an error, or you would like the room reopened, our team is here to help.",
  },
};

export function ViewingRoomAccessEnded({ status, onNewCode }: { status: "expired" | "revoked"; onNewCode: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = copy[status];
  const subject = encodeURIComponent("Renewed access to my private viewing room");
  const body = encodeURIComponent("Hello Maison Affluency team,\n\nMy private viewing room access has ended and I would like it renewed.\n\nThank you.");
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(VIEWING_ROOM_CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <main className="viewing-room flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center justify-center border-b border-border px-6 py-6">
        <img src={affluencyLogo} alt="Affluency" className="h-7 w-auto mix-blend-multiply" />
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Private Viewing Room</p>
          <h1 className="mt-6 font-display text-4xl leading-tight md:text-5xl">{text.title}</h1>
          <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">{text.body}</p>
          <div className="mx-auto mt-10 flex max-w-md flex-col gap-3">
            <Button asChild className="h-12 w-full rounded-none text-sm">
              <a href={`mailto:${VIEWING_ROOM_CONTACT_EMAIL}?subject=${subject}&body=${body}`}>
                <Mail className="size-4" />
                Contact our team for renewed access
              </a>
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-none text-sm" onClick={() => void copyEmail()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Email address copied" : VIEWING_ROOM_CONTACT_EMAIL}
            </Button>
          </div>
          <button
            type="button"
            onClick={onNewCode}
            className="mx-auto mt-10 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            I have a new access code
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
      <footer className="flex items-center justify-center px-6 py-8 text-xs text-muted-foreground">
        <span>Curated by Maison Affluency</span>
      </footer>
    </main>
  );
}
