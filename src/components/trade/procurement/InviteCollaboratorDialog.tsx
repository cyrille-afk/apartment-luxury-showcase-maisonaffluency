import { useState } from "react";
import { Link2 as LinkIcon } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { copyTextToClipboard } from "@/lib/clipboard";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

// Share links must always point at the public production domain — the preview
// runs on a sandbox origin (lovableproject.com) that recipients cannot use.
const SHARE_ORIGIN = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? window.location.origin
  : "https://www.maisonaffluency.com";

/** Masked display alias — never shows the raw token. */
function maskLink(url: string) {
  try { return `://${new URL(url).hostname}…`; } catch { return "://…"; }
}


export default function InviteCollaboratorDialog({ open, onOpenChange, boardId, onInvited }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  boardId: string;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"client" | "contractor">("client");
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setEmail(""); setRole("client"); setLink(null); setError(null); };

  const send = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("create_board_invite" as any, { _board_id: boardId, _email: parsed.data, _role: role });
    if (err || !data) {
      setSending(false);
      setError("Could not create the invite.");
      return;
    }
    const { id, token } = data as { id: string; token: string };
    const url = `${SHARE_ORIGIN}/shared/board/${token}`;
    setLink(url);
    const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: { templateName: "board-collaborator-invite", recipientEmail: parsed.data, idempotencyKey: `board-invite-${id}`, templateData: { token } },
    });
    setSending(false);
    onInvited();
    toast({ title: mailErr ? "Invite created — email could not be sent, copy the link instead" : `Invite sent to ${parsed.data}` });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">Invite Collaborator</DialogTitle>
          <DialogDescription className="font-body text-xs">They receive a private link to this board, valid for 30 days.</DialogDescription>
        </DialogHeader>
        {!link ? (
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="font-body text-[10px] uppercase tracking-[0.18em]">Email</Label>
              <Input id="invite-email" type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} className="rounded-none" placeholder="name@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role" className="font-body text-[10px] uppercase tracking-[0.18em]">Role</Label>
              <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as any)} className="h-10 w-full rounded-none border border-input bg-background px-3 font-body text-sm">
                <option value="client">Client (Read-Only + Comment/Approve)</option>
                <option value="contractor">External Contractor (Can edit/add items)</option>
              </select>
            </div>
            {error && <p className="font-body text-xs text-destructive">{error}</p>}
            <Button onClick={send} disabled={sending} className="w-full rounded-none">{sending ? "Sending…" : "Send Invite"}</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-stretch gap-2">
              <Input readOnly value={maskLink(link)} aria-label="Secure invitation link" className="rounded-none font-body text-xs text-muted-foreground" />
              <Button variant="outline" className="rounded-none whitespace-nowrap" onClick={async () => { await copyTextToClipboard(link); toast({ title: "Secure invitation link copied to clipboard" }); }}>
                <LinkIcon className="h-3.5 w-3.5" /> Copy Link
              </Button>
            </div>
            <Button className="w-full rounded-none" onClick={reset}>Invite Another</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
