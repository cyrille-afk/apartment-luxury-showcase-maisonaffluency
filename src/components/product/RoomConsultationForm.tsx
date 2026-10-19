import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { roomCollections, type CollectionRoom } from '@/lib/roomCollections';
import { roomConsultationSchema, type RoomConsultationInput } from '@/lib/roomConsultation';

export default function RoomConsultationForm({ room }: { room: CollectionRoom }) {
  const [profession, setProfession] = useState<RoomConsultationInput['profession']>('interior-designer');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const name = roomCollections[room].name;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = roomConsultationSchema.safeParse({ ...values, profession, room });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Please check your details.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await supabase.functions.invoke('room-consultation', { body: parsed.data });
      if (result.error || !result.data?.success) throw new Error('Your inquiry could not be sent. Your details are still here; please try again.');
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const field = (key: string, label: string, maxLength: number, required = false, type = 'text') => <div className="space-y-2">
    <Label htmlFor={`consultation-${key}`}>{label}{!required && <span className="ml-2 text-xs text-muted-foreground">Optional</span>}</Label>
    <Input id={`consultation-${key}`} name={key} type={type} maxLength={maxLength} required={required} autoComplete={key === 'name' ? 'name' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'company' ? 'organization' : 'off'} />
  </div>;
  return <section aria-label="Design consultation" className="border-t border-border bg-muted/30">
    <div className="mx-auto grid max-w-[1500px] gap-10 px-6 py-14 md:grid-cols-[1fr_2fr] md:gap-16 md:py-20">
      <div>
        <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">For architects & interior designers</p>
        <h2 className="mt-4 font-display text-3xl">A considered {name.toLowerCase()}</h2>
        <p className="mt-5 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">Discuss your space with Maison Affluency — from a single defining piece to a complete composition.</p>
        <a className="mt-6 inline-block font-body text-sm text-primary underline underline-offset-4" href="mailto:concierge@maisonaffluency.com">concierge@maisonaffluency.com</a>
      </div>
      {sent ? <div role="status" className="flex items-start gap-4 py-8"><Check className="mt-1 size-6 shrink-0 text-primary" /><div><h3 className="font-display text-2xl">Inquiry received</h3><p className="mt-3 font-body text-sm text-muted-foreground">Thank you. Your {name.toLowerCase()} brief has been sent to Maison Affluency.</p></div></div> : <form onSubmit={submit} className="max-w-3xl space-y-6 font-body">
        <fieldset disabled={busy} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">{field('name', 'Full name', 100, true)}{field('email', 'Work email', 255, true, 'email')}{field('company', 'Studio / firm', 150, true)}
            <div className="space-y-2"><Label htmlFor="consultation-profession">Profession</Label><Select value={profession} onValueChange={value => { if (value === 'architect' || value === 'interior-designer') setProfession(value); }}><SelectTrigger id="consultation-profession"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="interior-designer">Interior designer</SelectItem><SelectItem value="architect">Architect</SelectItem></SelectContent></Select></div>
            {field('phone', 'Phone', 50, false, 'tel')}{field('project', 'Project name', 200)}{field('location', 'Project location', 200)}
          </div>
          <div className="space-y-2"><Label htmlFor="consultation-message">Your {name.toLowerCase()} brief</Label><Textarea id="consultation-message" name="message" required maxLength={4000} rows={5} placeholder="Tell us about the space, pieces, materials or finishes you are considering." /></div>
          <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
          <p className="text-xs leading-relaxed text-muted-foreground">Your details will be used to respond to this inquiry. <a href="/privacy" className="underline underline-offset-4">Privacy policy</a></p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="gap-3">{busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}{busy ? 'Sending inquiry…' : 'Request a design consultation'}</Button>
        </fieldset>
      </form>}
    </div>
  </section>;
}