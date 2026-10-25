import { useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { canResendBoardInvitation, type BoardInvitation } from "./boardInvitationStatus";

type Attempt = { id: string; token: string; email: string };

export default function ResendBoardInvitation({ projectId, boardId, invite, now, disabled = false, onRenewed }: {
  projectId: string; boardId: string; invite: BoardInvitation; now: number; disabled?: boolean; onRenewed: () => void;
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const locked = useRef(false);
  if (!canResendBoardInvitation(invite, now) && !attempt) return null;

  const resend = async () => {
    if (locked.current || disabled || sent) return;
    locked.current = true; setSending(true); setFeedback("");
    let renewed = attempt;
    try {
      if (!renewed) {
        const { data, error } = await supabase.rpc("resend_expired_project_board_invite", {
          _project_id: projectId, _board_id: boardId, _invite_id: invite.id,
        });
        if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof data.id !== "string" || typeof data.token !== "string" || typeof data.email !== "string") {
          setFeedback("Access could not be renewed. Refresh invitations and try again."); return;
        }
        renewed = { id: data.id, token: data.token, email: data.email };
        setAttempt(renewed);
      }
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: { templateName: "board-collaborator-invite", recipientEmail: renewed.email,
          idempotencyKey: `board-invite-${renewed.id}`, templateData: { token: renewed.token } },
      });
      if (error) { setFeedback("Access renewed, but the email could not be sent. Retry sending."); return; }
      setSent(true); setFeedback("Invitation sent · Access renewed for 30 days.");
    } catch {
      setFeedback(renewed ? "Access renewed, but sending could not be confirmed. Retry sending." : "Access could not be renewed. Refresh invitations and try again.");
    } finally {
      locked.current = false; setSending(false); onRenewed();
    }
  };

  return <div className="mt-2 space-y-2">
    {!sent && <Button variant="outline" size="sm" disabled={disabled || sending} onClick={() => void resend()} aria-label={`${attempt ? "Retry invitation email" : "Resend expired invitation"} for ${invite.email}`}>
      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
      {sending ? "Sending…" : attempt ? "Retry sending" : "Resend invitation"}
    </Button>}
    {feedback && <p role={sent ? "status" : "alert"} className={`text-xs ${sent ? "text-muted-foreground" : "text-destructive"}`}>{feedback}</p>}
  </div>;
}