import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string | null;
  invitedName?: string | null;
  messages: Msg[];
}

// "Book Singapore District 9 viewing" hand-off modal.
// Bilingual copy (EN + 中文) — trade users in the CN portal expect both.
// Fires concierge-cn-brief with viewing_requested:true, which inserts a
// director brief and emails the Greater China desk immediately.
export function CnBriefViewingModal({ open, onOpenChange, sessionId, invitedName, messages }: Props) {
  const [name, setName] = useState(invitedName || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      toast.error("请填写称呼与联系方式 · Please add a name and one contact.");
      return;
    }
    setSubmitting(true);
    try {
      const augmented: Msg[] = notes.trim()
        ? [...messages, { role: "user", content: `[Viewing request notes] ${notes.trim()}` }]
        : messages;
      const { data, error } = await supabase.functions.invoke("concierge-cn-brief", {
        body: {
          session_id: sessionId || null,
          invited_name: name.trim(),
          contact_email: email.trim() || null,
          contact_phone: phone.trim() || null,
          messages: augmented,
          force: true,
          viewing_requested: true,
        },
      });
      if (error) throw error;
      toast.success("已收到 · Received. Our Greater China director will be in touch within 12 hours.");
      onOpenChange(false);
      setNotes("");
    } catch (e) {
      console.error("cn-brief viewing submit", e);
      toast.error("提交失败 · Could not submit. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>预约新加坡第九区鉴赏 · Book a Singapore District 9 Viewing</DialogTitle>
          <DialogDescription>
            Our director will personally curate the in-situ pieces and confirm within 12 hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input placeholder="称呼 · Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="邮箱 · Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="电话 / 微信 · Phone or WeChat" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Textarea
            placeholder="备注（可选）· Notes (optional) — dates, project, pieces of interest"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>取消 · Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            提交 · Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
