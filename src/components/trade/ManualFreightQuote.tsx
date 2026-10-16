import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Truck, Loader2 } from 'lucide-react';
import { manualFreightCents } from '@/lib/manualFreight';
import { formatPdfMoney } from '@/lib/pdfFormatting';
import type { Tables } from '@/integrations/supabase/types';

type Record = Tables<'manual_freight_requests'>;
interface Props {
  quoteId: string; itemId: string; productName: string; brandName: string; sku: string;
  quantity: number; origin: string; destination: string; currency: string;
  packingMissing: boolean; locked: boolean; onRecorded: () => void;
}

export default function ManualFreightQuote(p: Props) {
  const { user, isAdmin, isSuperAdmin, rolesLoaded } = useAuth();
  const { toast } = useToast();
  const [record, setRecord] = useState<Record | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [carrier, setCarrier] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [ccy, setCcy] = useState(p.currency);
  const [validUntil, setValidUntil] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const canRecord = rolesLoaded && (isAdmin || isSuperAdmin) && !p.locked;
  useEffect(() => {
    let active = true;
    supabase.from('manual_freight_requests').select('*').eq('quote_item_id', p.itemId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) { toast({ title: 'Could not load freight request', description: error.message, variant: 'destructive' }); return; }
      setRecord(data); setReady(true);
      if (data) {
        setNotes(data.request_notes || ''); setCarrier(data.carrier || ''); setReference(data.supplier_reference || '');
        setAmount(data.amount_cents == null ? '' : (data.amount_cents / 100).toFixed(2));
        setCcy(data.currency); setValidUntil(data.valid_until || ''); setSupplierNotes(data.supplier_notes || '');
      }
    });
    return () => { active = false; };
  }, [p.itemId, toast]);

  async function request() {
    if (!user || busy) return;
    setBusy(true);
    try {
      let saved = record;
      if (!saved) {
        const { data, error } = await supabase.from('manual_freight_requests').insert({
          quote_id: p.quoteId, quote_item_id: p.itemId, requested_by: user.id, product_name: p.productName,
          quantity: p.quantity, origin_country: p.origin, destination_country: p.destination,
          currency: p.currency, request_notes: notes.trim() || null,
        }).select('*').single();
        if (error) throw error;
        saved = data; setRecord(data);
      }
      if (!saved) throw new Error('Request was not saved');
      const recipients = ['concierge@maisonaffluency.com', ...(isAdmin || isSuperAdmin ? ['cyrille@maisonaffluency.com', 'gregoire@maisonaffluency.com'] : [])];
      for (const recipientEmail of recipients) {
        const { data, error } = await supabase.functions.invoke('send-transactional-email', { body: {
          templateName: 'manual-shipping-quote-request', recipientEmail,
          idempotencyKey: `manual-freight-${saved.id}-${recipientEmail}`,
          templateData: { quoteNumber: `QU-${p.quoteId.slice(0, 6).toUpperCase()}`, productName: p.productName,
            brandName: p.brandName, sku: p.sku, quantity: saved.quantity, origin: saved.origin_country,
            destination: saved.destination_country, requesterName: user.user_metadata?.full_name || user.email || '—',
            requesterEmail: user.email || '', requesterCompany: '', message: saved.request_notes || '' },
        }});
        if (error || data?.error || data?.success === false) throw new Error(error?.message || data?.error || 'Notification failed');
      }
      toast({ title: 'Freight request saved and sent' }); setOpen(false);
    } catch (error) {
      toast({ title: 'Could not send freight request', description: `${error instanceof Error ? error.message : 'Please retry'}. Any saved request is retained.`, variant: 'destructive' });
    } finally { setBusy(false); }
  }
  async function savePrice() {
    if (!record || !canRecord || busy) return;
    const cents = manualFreightCents(amount);
    if (cents == null || !carrier.trim()) { toast({ title: 'Enter a supplier and a positive freight amount', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from('manual_freight_requests').update({ status: 'quoted', carrier: carrier.trim(),
        supplier_reference: reference.trim() || null, amount_cents: cents, currency: ccy,
        valid_until: validUntil || null, supplier_notes: supplierNotes.trim() || null,
      }).eq('id', record.id).select('*').single();
      if (error) throw error;
      setRecord(data); p.onRecorded(); setOpen(false);
      toast({ title: 'Manual freight recorded', description: 'Added once to Additional charges and the quote PDF.' });
    } catch (error) { toast({ title: 'Could not record freight', description: error instanceof Error ? error.message : 'Please retry', variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  if (!p.packingMissing && !record) return null;
  return <div className="md:col-span-4 mt-2 print:hidden font-body text-xs text-muted-foreground">
    <div className="flex flex-wrap items-center gap-2">
      <Truck className="h-3.5 w-3.5 shrink-0" />
      <span>{record?.status === 'quoted' ? `Manual freight: ${record.currency} ${formatPdfMoney(record.amount_cents || 0)} · ${record.carrier}` : record ? 'Manual freight requested · awaiting supplier quote' : 'Shipping estimate unavailable — packing details missing.'}</span>
      <Button variant="link" size="sm" disabled={!ready} onClick={() => setOpen(true)}>{record ? 'View freight request' : 'Request manual freight'}</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Manual freight · {p.productName}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{p.brandName} · Qty {record?.quantity || p.quantity} · {record?.origin_country || p.origin || 'Origin pending'} → {record?.destination_country || p.destination || 'Destination pending'}</p>
      {record && <p className="text-xs text-muted-foreground">Requested {new Date(record.requested_at).toLocaleString('en-GB')}{record.recorded_at ? ` · Recorded ${new Date(record.recorded_at).toLocaleString('en-GB')}` : ''}</p>}
      <Label htmlFor={`freight-notes-${p.itemId}`}>Request notes</Label>
      <Textarea id={`freight-notes-${p.itemId}`} value={notes} onChange={e => setNotes(e.target.value)} disabled={!!record} />
      {!p.locked && record?.status !== 'quoted' && <Button onClick={request} disabled={busy || !ready}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {record ? 'Resend request' : 'Send freight request'}</Button>}
      {record && (canRecord || record.status === 'quoted') && <div className="space-y-3 border-t border-border pt-4">
        <h3 className="font-medium">Supplier freight quote</h3>
        <Label htmlFor={`freight-carrier-${p.itemId}`}>Supplier / carrier</Label><Input id={`freight-carrier-${p.itemId}`} value={carrier} onChange={e => setCarrier(e.target.value)} disabled={!canRecord} />
        <Label htmlFor={`freight-ref-${p.itemId}`}>Supplier reference</Label><Input id={`freight-ref-${p.itemId}`} value={reference} onChange={e => setReference(e.target.value)} disabled={!canRecord} />
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor={`freight-amount-${p.itemId}`}>Total freight amount</Label><Input id={`freight-amount-${p.itemId}`} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={!canRecord} /></div>
        <div><Label htmlFor={`freight-currency-${p.itemId}`}>Currency</Label><select id={`freight-currency-${p.itemId}`} className="h-10 w-full border border-input rounded-md bg-background px-2" value={ccy} onChange={e => setCcy(e.target.value)} disabled={!canRecord}>{['EUR','USD','GBP','SGD','HKD','CHF','AED','AUD','CAD','JPY'].map(c => <option key={c}>{c}</option>)}</select></div></div>
        <Label htmlFor={`freight-valid-${p.itemId}`}>Valid until</Label><Input id={`freight-valid-${p.itemId}`} type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} disabled={!canRecord} />
        <Label htmlFor={`freight-supplier-notes-${p.itemId}`}>Inclusions / exclusions</Label><Textarea id={`freight-supplier-notes-${p.itemId}`} value={supplierNotes} onChange={e => setSupplierNotes(e.target.value)} disabled={!canRecord} />
        {canRecord && <Button onClick={savePrice} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}Record freight quote</Button>}
      </div>}
    </DialogContent></Dialog>
  </div>;
}