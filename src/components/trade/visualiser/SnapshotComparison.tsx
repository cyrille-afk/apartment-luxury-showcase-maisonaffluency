import { useEffect, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { ComparisonAnnotations } from '@/lib/snapshotComparisonPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadProjectSnapshot, type ProjectSnapshot, type ProjectSnapshotData } from '@/lib/projectLayoutSnapshots';
import { snapshotChanges, snapshotFinishes, snapshotFootprint } from '@/lib/projectSnapshotComparison';
import type { PlacedObject } from './SceneObject';
import { downloadSnapshotComparison } from '@/lib/snapshotComparisonPdf';

function Piece({ object }: { object?: PlacedObject }) {
  if (!object) return <p className="text-xs text-muted-foreground">Not in this snapshot</p>;
  const finishes = snapshotFinishes(object);
  return <div className="space-y-2">
    <div className="flex gap-3">{object.image_url && <img src={object.image_url} alt="" className="h-12 w-12 shrink-0 object-contain" />}<div className="min-w-0"><p className="break-words text-sm font-medium">{object.product_name}</p><p className="text-xs text-muted-foreground">{object.brand_name}</p></div></div>
    <p className="text-xs text-muted-foreground">X {object.position[0].toFixed(2)} m · Z {object.position[2].toFixed(2)} m · {(object.rotation[1] * 180 / Math.PI).toFixed(0)}°</p>
    {finishes.map((finish, i) => <div key={`${finish.label}-${i}`} className="flex items-center gap-2">{finish.image && <img src={finish.image} alt={finish.name} className="h-9 w-9 shrink-0 object-cover" />}<p className="min-w-0 break-words text-xs"><span className="text-muted-foreground">{finish.label}: </span>{finish.name}</p></div>)}
    {!finishes.length && <p className="text-xs text-muted-foreground">Original product finishes</p>}
  </div>;
}

function Layout({ data, name, selected, onSelect }: { data: ProjectSnapshotData; name: string; selected: string | null; onSelect: (id: string) => void }) {
  const { width, depth } = data.bounds;
  return <svg role="img" aria-label={`${name} furniture layout`} viewBox={`${-width / 2 - 1} ${-depth / 2 - 1} ${width + 2} ${depth + 2}`} className="aspect-[4/3] w-full border border-border bg-muted text-foreground">
    <rect x={-width / 2} y={-depth / 2} width={width} height={depth} fill="none" stroke="currentColor" strokeWidth="0.04" />
    {data.scene.objects.map((o, index) => { const footprint = snapshotFootprint(o); return <g key={o.instanceId} transform={`translate(${o.position[0]} ${o.position[2]}) rotate(${-o.rotation[1] * 180 / Math.PI})`}><rect x={-footprint.width / 2} y={-footprint.depth / 2} width={footprint.width} height={footprint.depth} fill="currentColor" opacity={selected === o.instanceId ? 0.9 : 0.3} stroke="currentColor" strokeWidth="0.04" /><text textAnchor="middle" dominantBaseline="middle" fontSize="0.25" className="fill-background">{index + 1}</text><title>{o.product_name}</title></g>; })}
  </svg>;
}

export default function SnapshotComparison({ projectKey, snapshots, onClose, onRestore }: { projectKey: string; snapshots: ProjectSnapshot[]; onClose: () => void; onRestore: (snapshot: ProjectSnapshot) => void }) {
  const [ids, setIds] = useState<[string, string]>([snapshots[0]?.id ?? '', snapshots[1]?.id ?? '']);
  const [data, setData] = useState<[ProjectSnapshotData, ProjectSnapshotData] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  // Annotations are a draft per snapshot pair, kept in this browser session only.
  const noteKey = `ma-snapshot-compare-notes:${projectKey}:${ids[0]}:${ids[1]}`;
  const [annotations, setAnnotations] = useState<ComparisonAnnotations>({});
  const [debounced, setDebounced] = useState<ComparisonAnnotations>({});
  useEffect(() => {
    let saved: ComparisonAnnotations = {};
    try { saved = JSON.parse(sessionStorage.getItem(noteKey) || '{}'); } catch { /* ignore */ }
    setAnnotations(saved); setDebounced(saved);
  }, [noteKey]);
  useEffect(() => {
    try { sessionStorage.setItem(noteKey, JSON.stringify(annotations)); } catch { /* private mode */ }
    const t = window.setTimeout(() => setDebounced(annotations), 500);
    return () => window.clearTimeout(t);
  }, [annotations, noteKey]);
  const setNote = (id: string, value: string) => setAnnotations(a => ({ ...a, notes: { ...a.notes, [id]: value.slice(0, 600) } }));
  useEffect(() => {
    let active = true; setData(null); setError(false); setSelected(null);
    Promise.all(ids.map(id => loadProjectSnapshot(projectKey, id))).then(([left, right]) => { if (active) setData([left, right]); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [projectKey, ids, retry]);
  useEffect(() => {
    let active = true;
    setPdf(null); setPdfError(false); setPreparing(false);
    const left = snapshots.find(s => s.id === ids[0]), right = snapshots.find(s => s.id === ids[1]);
    if (!data || !left || !right) return;
    setPreparing(true);
    import('@/lib/snapshotComparisonPdf').then(module => module.buildSnapshotComparisonPdf({ snapshot: left, data: data[0] }, { snapshot: right, data: data[1] }, debounced))
      .then(blob => { if (active) setPdf(blob); })
      .catch(() => { if (active) setPdfError(true); })
      .finally(() => { if (active) setPreparing(false); });
    return () => { active = false; };
  }, [data, ids, snapshots, projectKey, retry, debounced]);
  const changes = data ? snapshotChanges(data[0], data[1]) : [];
  return <Dialog open onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto p-5 sm:p-6">
    <DialogHeader><DialogTitle>Compare Project Snapshots</DialogTitle><DialogDescription className="sr-only">Read-only layout and finish comparison</DialogDescription></DialogHeader>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" disabled={!pdf || !data || preparing} onClick={() => { if (pdf) void downloadSnapshotComparison(pdf).catch(() => setPdfError(true)); }}>{preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download client PDF</Button>{pdfError && <div role="alert" className="text-xs text-destructive">PDF couldn't be prepared.<Button variant="link" size="sm" onClick={() => setRetry(n => n + 1)}>Retry</Button></div>}<label className="flex items-center gap-2 text-xs"><Switch checked={annotations.highlightChanges !== false} onCheckedChange={v => setAnnotations(a => ({ ...a, highlightChanges: v }))} aria-label="Highlight changes in PDF" />Highlight changes in PDF</label></div>
    {data && <Textarea aria-label="Studio note for client" placeholder="Studio note for your client (appears at the top of the differences page)" maxLength={1200} value={annotations.summary ?? ''} onChange={e => setAnnotations(a => ({ ...a, summary: e.target.value }))} className="min-h-16 text-sm" />}
    <div className="grid grid-cols-2 gap-3 sm:gap-6">{ids.map((id, side) => { const snapshot = snapshots.find(s => s.id === id); return <section key={side} className="min-w-0 space-y-3">
      <Select value={id} onValueChange={value => setIds(previous => side === 0 ? [value, previous[1]] : [previous[0], value])}><SelectTrigger aria-label={side === 0 ? 'Left snapshot' : 'Right snapshot'} className="min-w-0"><SelectValue /></SelectTrigger><SelectContent>{snapshots.map(s => <SelectItem key={s.id} value={s.id} disabled={s.id === ids[1 - side]}>{s.name}</SelectItem>)}</SelectContent></Select>
      {snapshot && <p className="text-xs text-muted-foreground">{new Date(snapshot.created_at).toLocaleString()}</p>}
      {data && <><Layout data={data[side]} name={snapshot?.name ?? ''} selected={selected} onSelect={setSelected} /><p className="text-xs text-muted-foreground">{data[side].bounds.width} × {data[side].bounds.depth} × {data[side].bounds.height} m · {data[side].scene.objects.length} pieces</p>{data[side].floorPlanUrl && <a href={data[side].floorPlanUrl ?? undefined} className="block text-xs underline">Floor plan</a>}<p className="break-words text-xs text-muted-foreground">Floor: {data[side].scene.floorFinish ?? 'Default'} · Wall: {data[side].scene.featureWallFinish ?? data[side].scene.wallFinish ?? 'Default'}</p>
        <Button variant="outline" size="sm" className="h-auto min-h-9 w-full whitespace-normal" onClick={() => { if (snapshot) onRestore(snapshot); }}><RotateCcw className="h-3.5 w-3.5 shrink-0" />Restore this snapshot</Button></>}
    </section>; })}</div>
    {!data && !error && <div role="status" className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /><span className="sr-only">Loading comparison</span></div>}
    {error && <div role="alert" className="py-6 text-sm">Snapshots couldn't load.<Button variant="link" onClick={() => setRetry(n => n + 1)}>Retry</Button></div>}
    {data && <div><h3 className="mb-3 text-sm font-medium">Furniture &amp; Finishes · {changes.filter(c => c.status !== 'Unchanged').length} changed pieces</h3>{changes.length === 0 && <p className="text-sm text-muted-foreground">Both snapshots have no furniture.</p>}{changes.map(change => <div key={change.id} className="border-t border-border py-4" onMouseEnter={() => setSelected(change.id)} onMouseLeave={() => setSelected(null)}><p className="mb-3 text-xs font-medium">{change.status}{change.layoutChanged ? ' · Layout' : ''}{change.finishesChanged ? ' · Finishes' : ''}</p><div className="grid grid-cols-2 gap-3 sm:gap-6"><Piece object={change.before} /><Piece object={change.after} /></div>{change.status !== 'Unchanged' && <Textarea aria-label={`Client note for ${(change.after ?? change.before)?.product_name ?? 'piece'}`} placeholder="Add a note on this difference for the client PDF" maxLength={600} value={annotations.notes?.[change.id] ?? ''} onChange={e => setNote(change.id, e.target.value)} className="mt-3 min-h-12 text-xs" />}</div>)}</div>}
  </DialogContent></Dialog>;
}