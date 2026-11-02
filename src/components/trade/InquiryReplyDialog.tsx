import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type ReplyInquiry = { id: string; name: string; email: string; subject: string | null; product_name: string | null };
export function InquiryReplyDialog({ inquiry, onClose }: { inquiry: ReplyInquiry | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [key, setKey] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [queued, setQueued] = useState(false);
  const storageKey = user && inquiry ? `ma-inquiry-reply:${user.id}:${inquiry.id}` : null;
  useEffect(() => {
    setReady(false); setError(""); setQueued(false);
    if (!inquiry || !storageKey) return;
    let saved: { subject?: string; body?: string; key?: string } = {};
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}"); } catch { /* empty draft */ }
    setSubject(saved.subject || `Re: ${inquiry.subject || inquiry.product_name || "Your Maison Affluency inquiry"}`);
    setBody(saved.body || "");
    setKey(saved.key || `inquiry-reply-${inquiry.id}-${crypto.randomUUID()}`);
    setReady(true);
  }, [inquiry?.id, storageKey]);
  useEffect(() => {
    if (ready && storageKey && !queued) {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ subject, body, key })); } catch { /* storage unavailable */ }
    }
  }, [ready, storageKey, subject, body, key, queued]);
  const { data: history, error: historyError } = useQuery({
    queryKey: ["inquiry-replies", inquiry?.id], enabled: !!inquiry,
    refetchInterval: inquiry ? 3000 : false,
    queryFn: async () => {
      if (!inquiry) return [];
      const { data, error } = await supabase.from("email_send_log")
        .select("id, message_id, status, created_at, metadata")
        .eq("template_name", "inquiry-reply").contains("metadata", { inquiry_id: inquiry.id })
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      const attempts = data || [];
      const ids = attempts.map(row => row.message_id).filter((id): id is string => !!id);
      if (!ids.length) return attempts;
      const { data: statuses, error: statusError } = await supabase.from("email_send_log")
        .select("message_id, status, created_at").in("message_id", ids).order("created_at", { ascending: false }).limit(100);
      if (statusError) throw statusError;
      return attempts.map(row => ({ ...row, status: statuses?.find(s => s.message_id === row.message_id)?.status || row.status }));
    },
  });
  const seen = new Set<string>();
  const messages = (history || []).filter(row => { const id = row.message_id || row.id; if (seen.has(id)) return false; seen.add(id); return true; });
  return <Dialog open={!!inquiry} onOpenChange={open => { if (!open && !sending) onClose(); }}>
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" hideClose={sending}>
      <DialogHeader><DialogTitle>Reply to {inquiry?.name}</DialogTitle><DialogDescription>{inquiry?.email}</DialogDescription></DialogHeader>
      <div className="space-y-4">
        {queued ? <p role="status" className="text-sm text-foreground">Reply queued. Sending status appears below.</p> : <form className="space-y-4" onSubmit={async event => {
          event.preventDefault(); if (!inquiry || sending || !ready) return;
          setSending(true); setError("");
          try {
            const { data, error } = await supabase.functions.invoke("send-transactional-email", { body: {
              templateName: "inquiry-reply", idempotencyKey: key,
              templateData: { inquiryId: inquiry.id, subjectText: subject, bodyText: body },
            } });
            if (error || data?.success !== true) throw new Error(data?.reason === "email_suppressed" ? "This recipient has opted out of app emails. The reply was not sent." : "We couldn’t queue this reply. Your draft is kept; please retry.");
            setQueued(true);
            if (storageKey) sessionStorage.removeItem(storageKey);
            await qc.invalidateQueries({ queryKey: ["inquiry-replies", inquiry.id] });
          } catch (error) { setError(error instanceof Error ? error.message : "Reply failed. Your draft is kept."); }
          finally { setSending(false); }
        }}>
          <div><label htmlFor="inquiry-reply-subject" className="mb-1 block text-sm">Subject</label><Input id="inquiry-reply-subject" value={subject} maxLength={200} required disabled={sending || !ready} onChange={e => { setSubject(e.target.value); setKey(`inquiry-reply-${inquiry?.id}-${crypto.randomUUID()}`); }} /></div>
          <div><label htmlFor="inquiry-reply-message" className="mb-1 block text-sm">Your reply</label><Textarea id="inquiry-reply-message" value={body} rows={8} maxLength={20000} required disabled={sending || !ready} onChange={e => { setBody(e.target.value); setKey(`inquiry-reply-${inquiry?.id}-${crypto.randomUUID()}`); }} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={sending}>Cancel</Button><Button type="submit" disabled={sending || !ready || !body.trim() || !subject.trim()}><Send />{sending ? "Sending…" : "Send reply"}</Button></div>
        </form>}
        {historyError && <p role="alert" className="text-sm text-destructive">Reply history couldn’t load. Please reopen this reply.</p>}
        {!!messages.length && <section className="border-t border-border pt-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-medium"><Mail className="size-4" />Reply history</h3>
          {messages.map(row => { const meta = row.metadata as Record<string, unknown> | null; return <div key={row.id} className="mb-3 text-sm">
            <p className="text-muted-foreground">{row.status === "sent" ? "Sent" : row.status === "pending" ? "Queued" : row.status === "suppressed" ? "Not sent — opted out" : "Sending failed"} · {new Date(row.created_at).toLocaleString()}</p>
            {typeof meta?.subject === "string" && <p>{meta.subject}</p>}{typeof meta?.body === "string" && <p className="whitespace-pre-wrap text-muted-foreground">{meta.body}</p>}
          </div>; })}
        </section>}
      </div>
    </DialogContent>
  </Dialog>;
}