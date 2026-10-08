import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { parseDraftBody, type NotificationDraft } from '../../../supabase/functions/_shared/applicationNotificationCopy';

type Props = {
  recipient: string; company: string; approval: boolean; initialDraft: NotificationDraft;
  busy: boolean; error: string | null; onClose: () => void; onSend: (draft: NotificationDraft) => void;
};

export default function ApplicationNotificationDrawer({ recipient, company, approval, initialDraft, busy, error, onClose, onSend }: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [previewMode, setPreviewMode] = useState<'styled' | 'plain'>('styled');
  const blocks = parseDraftBody(draft.body);
  // Mirrors the plain-text part built by the trade-approval/trade-rejection
  // templates when an admin-edited draft body is present (bodyText branch).
  const plainTextPreview = [
    'MAISON AFFLUENCY — Unique by Design',
    '',
    draft.body.trim(),
    ...(approval ? [
      '',
      'ACTIVATE YOUR TRADE ACCESS',
      'https://www.maisonaffluency.com/trade/activate?token_hash=…&type=recovery',
    ] : []),
    '',
    '—',
    'Maison Affluency Singapore',
    'Unique by Design',
  ].join('\n');
  const lastBenefit = blocks.map(b => b.kind).lastIndexOf('benefit');
  const valid = draft.subject.trim().length > 0 && draft.subject.length <= 200 && !/[\r\n]/.test(draft.subject) && draft.body.trim().length > 0 && draft.body.length <= 20000;
  const portalAction = <div className="my-8 text-center"><span className="inline-block rounded-full bg-moodboard-ink px-8 py-4 text-xs uppercase text-card">Access Your Trade Portal</span></div>;
  return <Sheet open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <SheetContent side="right" className="flex w-full flex-col bg-background text-foreground sm:max-w-[780px]" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
      <SheetHeader className="shrink-0 border-b border-border pb-5 pr-8">
        <SheetTitle className="font-serif text-2xl">Review {approval ? 'Approval' : 'Decline'} Email</SheetTitle>
        <SheetDescription>{company}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-5">
        <div className="space-y-2"><Label htmlFor="notification-recipient">Recipient</Label><Input id="notification-recipient" value={recipient} readOnly /></div>
        <div className="space-y-2"><Label htmlFor="notification-subject">Subject</Label><Input id="notification-subject" value={draft.subject} maxLength={200} disabled={busy} onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} /></div>
        <div className="space-y-2"><Label htmlFor="notification-body">Email body</Label><Textarea id="notification-body" className="min-h-[320px] font-serif text-sm leading-relaxed" value={draft.body} maxLength={20000} disabled={busy} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} /></div>
        <section aria-label="Email layout preview" className="border-t border-border pt-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-xs uppercase text-muted-foreground">Email Preview</h3>
            <div role="group" aria-label="Preview format" className="flex gap-1 rounded-full border border-border p-1">
              {(['styled', 'plain'] as const).map(mode => (
                <button key={mode} type="button" aria-pressed={previewMode === mode} onClick={() => setPreviewMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs uppercase transition-colors ${previewMode === mode ? 'bg-moodboard-ink text-card' : 'text-muted-foreground hover:text-foreground'}`}>
                  {mode === 'styled' ? 'Styled' : 'Plain text'}
                </button>
              ))}
            </div>
          </div>
          {previewMode === 'plain' ? (
            <div className="mx-auto max-w-[600px]">
              <p className="mb-3 text-xs text-muted-foreground">Exactly what text-only email clients receive, based on your edits above.</p>
              <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed text-foreground">{plainTextPreview}</pre>
            </div>
          ) : (
          <div className="mx-auto max-w-[600px] font-serif text-foreground">
            <img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Affluency — Unique by Design" className="mx-auto mb-8 h-auto w-[420px] max-w-full" />
            <hr className="mb-6 border-border" />
            {blocks.map((block, i) => <div key={i}>
              {block.kind === 'greeting' ? <h4 className="mb-6 whitespace-pre-wrap text-2xl">{block.text}</h4>
                : block.kind === 'benefit' ? <div className="mb-[18px] grid grid-cols-[28px_1fr]">
                  <span>◆</span><div><p className="mb-1 text-[15px] font-bold leading-snug">{block.title}</p><p className="text-sm leading-relaxed">{block.description}</p>
                    {block.details.length > 0 && <ul className="ml-5 mt-2 list-disc space-y-1 text-[13px] leading-relaxed">{block.details.map((d, n) => <li key={n}>{d}</li>)}</ul>}
                  </div></div>
                : <p className={`mb-5 whitespace-pre-wrap text-[15px] leading-[1.8] ${approval && block.kind === 'intro' ? 'italic' : ''}`}>{block.text}</p>}
              {approval && i === lastBenefit && portalAction}
            </div>)}
            {approval && lastBenefit < 0 && portalAction}
            <hr className="my-6 border-border" /><p className="text-right text-xs text-muted-foreground">Maison Affluency Singapore<br /><em>Unique by Design</em></p>
          </div>
          )}
        </section>
      </div>
      <footer className="shrink-0 space-y-3 border-t border-border pt-4">
        {!approval && <p className="text-sm text-muted-foreground">Confirming rejects this application and permanently deletes its record once the notice is queued.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button className="h-auto min-h-11 whitespace-normal bg-moodboard-ink text-card hover:bg-moodboard-ink/90" disabled={busy || !valid} onClick={() => onSend(draft)}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} CONFIRM &amp; SEND NOTIFICATION
          </Button>
        </div>
      </footer>
    </SheetContent>
  </Sheet>;
}