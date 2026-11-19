import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import affluencyLogo from "@/assets/affluency-logo-full.jpeg";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function ViewingRoomInviteDialog({ open, onOpenChange, developerId, projectId, developerName, logoUrl, heroUrl, link, code, savedEmail, onEmailSaved, onActivity }: {
  open: boolean; onOpenChange: (open: boolean) => void; developerId: string; projectId: string; developerName: string; logoUrl: string | null; heroUrl: string | null; link: string; code: string; savedEmail: string; onEmailSaved: (email: string) => void; onActivity?: () => void;
}) {
  const [recipient, setRecipient] = useState(savedEmail);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const attempt = useRef<string | null>(null);
  useEffect(() => { if (open) { setRecipient(savedEmail); setFeedback(null); attempt.current = null; } }, [open, savedEmail]);

  const log = (kind: "attempt" | "sent" | "validation_error" | "send_failed") => { void supabase.from("viewing_room_invite_activity").insert({ developer_project_id: developerId, kind }).then(() => onActivity?.()); };
  const send = async () => {
    const email = recipient.trim().toLowerCase();
    window.__lovableEvents?.track?.("project.viewing_room_invite_attempted", { has_recipient: !!email }); log("attempt");
    if (!validEmail(email)) { window.__lovableEvents?.track?.("project.viewing_room_invite_validation_error", { reason: "invalid_email" }); log("validation_error"); setFeedback({ ok: false, text: "Enter a valid client email address." }); return; }
    setSending(true); setFeedback(null);
    attempt.current ??= crypto.randomUUID();
    try {
      if (email !== savedEmail.toLowerCase()) {
        const { error } = await supabase.from("developer_projects").update({ client_email: email }).eq("id", developerId).eq("project_id", projectId);
        if (!error) onEmailSaved(email);
      }
      const { error } = await supabase.functions.invoke("send-transactional-email", { body: {
        templateName: "viewing-room-invitation", recipientEmail: email, idempotencyKey: `viewing-room-invite-${developerId}-${attempt.current}`,
        templateData: { developerName, developerLogoUrl: logoUrl, heroImageUrl: heroUrl, link, code },
      } });
      if (error) { log("send_failed"); setFeedback({ ok: false, text: "The invitation couldn’t be sent. Please try again." }); return; }
      window.__lovableEvents?.track?.("project.viewing_room_invite_email_opened", { has_recipient: true }); log("sent");
      attempt.current = null;
      setFeedback({ ok: true, text: `Invitation sent to ${email}.` });
    } catch { setFeedback({ ok: false, text: "Sending couldn’t be confirmed. Please try again." }); }
    finally { setSending(false); }
  };

  return <Dialog open={open} onOpenChange={value => { if (!sending) onOpenChange(value); }}>
    <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Send invitation</DialogTitle><DialogDescription>Preview of the email your client will receive.</DialogDescription></DialogHeader>
      <div aria-label="Email preview" className="border border-border bg-card px-6 py-8 text-center font-display text-card-foreground">
        <div className="flex flex-col items-center gap-3">
          {logoUrl ? <img src={logoUrl} alt={developerName} className="h-12 max-w-40 object-contain" /> : <span className="text-lg">{developerName}</span>}
          <span className="text-xs text-muted-foreground">×</span>
          <img src={affluencyLogo} alt="Maison Affluency" className="h-6 w-auto mix-blend-multiply dark:invert dark:mix-blend-screen" />
        </div>
        {heroUrl && <img src={heroUrl} alt="" className="mt-6 aspect-[16/9] w-full object-cover" />}
        <hr className="my-6 border-border" />
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Private Viewing Room</p>
        <p className="mt-2 text-2xl">{developerName}</p>
        <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">You are invited to explore the residence layouts and curated furniture collections prepared for you by Maison Affluency.</p>
        <span className="mt-6 inline-block bg-primary px-6 py-3 font-sans text-xs tracking-wide text-primary-foreground">Enter the viewing room</span>
        <div className="mt-8 space-y-2 border-t border-border pt-5 font-sans text-[11px] leading-relaxed text-muted-foreground">
          <p>Private access code: <span className="text-foreground">{code}</span></p>
          <p className="break-all">Button not working? Open this link: <span className="underline">{link}</span></p>
          <p>This invitation is personal. Please do not forward it. · Maison Affluency Singapore</p>
        </div>
      </div>
      <div className="space-y-2"><Label htmlFor="viewing-room-invite-recipient">Recipient email</Label><Input id="viewing-room-invite-recipient" type="email" autoComplete="off" placeholder="client@example.com" value={recipient} disabled={sending} onChange={event => { setRecipient(event.target.value); setFeedback(null); }} /></div>
      <p role={feedback?.ok ? "status" : "alert"} className={`min-h-5 text-sm ${feedback?.ok ? "text-muted-foreground" : "text-destructive"}`}>{feedback?.text}</p>
      <DialogFooter><Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>{feedback?.ok ? "Done" : "Cancel"}</Button><Button disabled={sending || !recipient.trim()} onClick={() => void send()}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{sending ? "Sending…" : "Send Invitation"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
