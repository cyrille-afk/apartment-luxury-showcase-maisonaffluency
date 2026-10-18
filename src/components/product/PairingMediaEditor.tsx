import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCuratorPickDetail } from '@/hooks/useCuratorPickDetail';
import { pairingAxes, pairingAxisOptions, pairingSelectionComplete, type PairingSelection } from '@/lib/curatedPairingConfiguration';
import { pairingFinishImage, pairingSwatchFor, pairingVisualOptions } from '@/lib/pairingFinishVisuals';
import { pairingMediaKey, pairingMediaPreview, pairingUploadError, type PairingMedia } from '@/lib/pairingMedia';
import type { PairingFinishOption } from '@/lib/pairingFinishPricing';

export default function PairingMediaEditor({ pickId, hero, options, entries, onChange, onBusy }: { pickId: string; hero: string; options: PairingFinishOption[]; entries: PairingMedia[]; onChange: (entries: PairingMedia[]) => void; onBusy: (busy: boolean) => void }) {
  const { data: detail, isPending, isError } = useCuratorPickDetail(pickId);
  const { data: swatches = [], isPending: swatchesPending, isError: swatchesError } = useQuery({ queryKey: ['pairing-public-swatches', pickId], queryFn: async () => {
    const { data, error } = await supabase.from('product_fabric_swatches_public').select('name,image_url').eq('pick_id', pickId);
    if (error) throw error; return data || [];
  } });
  const [chosen, setChosen] = useState<PairingSelection>({ base: null, top: null, label: null });
  const [visual, setVisual] = useState<Partial<PairingSelection>>({});
  const [customId, setCustomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<string[]>([]);
  const rows = detail?.size_variants || [];
  const selection = Object.fromEntries(pairingAxes.map(axis => { const values = pairingAxisOptions(rows, axis); return [axis, chosen[axis] || (values.length === 1 ? values[0] : null)]; })) as PairingSelection;
  const imageSelection = { ...selection, ...visual };
  const custom = options.find(o => o.id === customId);
  const complete = options.length ? !!custom : rows.length ? pairingSelectionComplete(rows, selection) : !!imageSelection.label;
  const key = pairingMediaKey(imageSelection, custom?.id);
  const label = custom?.name || pairingAxes.map(a => imageSelection[a]).filter(Boolean).join(' / ');
  const current = entries.find(e => e.key === key);
  const catalogPhoto = pairingFinishImage(detail?.variant_image_map, detail?.gallery_images || [], rows, selection, custom?.name, imageSelection);
  const catalogMacro = pairingAxes.map(a => pairingSwatchFor(imageSelection[a] || '', swatches)?.image_url).find(Boolean) || pairingSwatchFor(custom?.name || '', swatches)?.image_url;
  const preview = pairingMediaPreview(hero, current?.product_image_url || catalogPhoto, current?.macro_image_url || catalogMacro, failed);
  const patch = (field: 'product_image_url' | 'macro_image_url', url: string | null) => onChange([...entries.filter(e => e.key !== key), { ...current, key, label, [field]: url }]);
  async function upload(file: File, field: 'product_image_url' | 'macro_image_url') {
    const invalid = pairingUploadError(file); if (invalid) { setError(invalid); return; }
    setBusy(true); onBusy(true); setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const valid = bitmap.width >= 512 && bitmap.height >= 512; bitmap.close();
      if (!valid) throw new Error('Use an image at least 512 × 512 pixels.');
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
      const path = `curated-pairings/${pickId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('assets').upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('assets').getPublicUrl(path);
      await new Promise<void>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(); img.onerror = () => reject(new Error('Uploaded image could not be previewed. Try uploading again.')); img.src = data.publicUrl; });
      patch(field, data.publicUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Your saved assignments are unchanged.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <section className="space-y-4 border-t border-border pt-4"><h3 className="font-display text-lg">Finish imagery</h3>
    {isPending || swatchesPending ? <p role="status">Loading finishes…</p> : isError || swatchesError ? <p role="alert" className="text-destructive">Finish choices could not be loaded.</p> : options.length ? <Select disabled={busy} value={customId} onValueChange={setCustomId}><SelectTrigger aria-label="Image finish"><SelectValue placeholder="Choose finish" /></SelectTrigger><SelectContent>{options.filter(o => o.name).map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select> : rows.length ? pairingAxes.map(axis => {
      const choices = pairingVisualOptions(pairingAxisOptions(rows, axis), swatches); if (!choices.length) return null;
      return <Select key={axis} disabled={busy} value={imageSelection[axis] || ''} onValueChange={name => { setChosen({ ...selection, [axis]: choices.find(c => c.name === name)?.value || name }); setVisual({ ...visual, [axis]: name }); }}><SelectTrigger aria-label={`Image ${axis} finish`}><SelectValue placeholder={axis === 'label' ? 'Choose size' : `Choose ${axis} finish`} /></SelectTrigger><SelectContent>{choices.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select>;
    }) : <Select disabled={busy} value={imageSelection.label || ''} onValueChange={name => setChosen({ ...selection, label: name })}><SelectTrigger aria-label="Image material"><SelectValue placeholder="Choose material" /></SelectTrigger><SelectContent>{swatches.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select>}
    {complete && <><p className="text-sm text-muted-foreground">{label}</p><div className="grid grid-cols-2 gap-3">{(['product_image_url','macro_image_url'] as const).map(field => <div key={field} className="space-y-2"><label className="block text-xs">{field === 'product_image_url' ? 'Product photo' : 'Macro texture tile'}<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" aria-label={field === 'product_image_url' ? 'Upload product photo' : 'Upload macro texture tile'} className="mt-2 block w-full text-xs" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file, field); e.target.value = ''; }} /></label>{current?.[field] && <Button disabled={busy} variant="ghost" size="sm" onClick={() => patch(field, null)}><Trash2 className="h-4 w-4" />Clear assignment</Button>}</div>)}</div>
      <div className="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-4"><img src={preview.image} alt="Finish product preview" className="h-48 w-full object-contain" onError={() => setFailed(f => [...f, preview.image])} />{preview.macro && <img src={preview.macro} alt="Macro texture preview" className="h-24 w-24 object-cover" onError={() => setFailed(f => [...f, preview.macro || ''])} />}</div><p role="status" className="text-sm text-muted-foreground">{preview.status}{failed.length ? ' · Image unavailable; fallback applied' : ''}</p>
      <Button variant="outline" disabled={busy || entries.length >= 100 || !!current} onClick={() => onChange([...entries, { key, label }])}><Plus className="h-4 w-4" />Track this finish</Button></>}
    {busy && <p role="status" className="text-sm"><Upload className="mr-2 inline h-4 w-4" />Uploading and checking preview…</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {entries.map(entry => <div key={entry.key} className="flex items-center justify-between gap-2 border-t border-border pt-3"><div className="min-w-0 text-xs"><p className="break-words">{entry.label}</p><p className="text-muted-foreground">{entry.product_image_url ? 'Product photo assigned' : 'Default product photo'} · {entry.macro_image_url ? 'Texture assigned' : 'Catalogue texture fallback'}</p></div><Button disabled={busy} variant="ghost" size="icon" title="Remove image assignment" aria-label={`Remove imagery ${entry.label}`} onClick={() => onChange(entries.filter(e => e.key !== entry.key))}><Trash2 className="h-4 w-4" /></Button></div>)}
  </section>;
}