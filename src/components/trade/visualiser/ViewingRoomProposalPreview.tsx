import { FileJson, Layers, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPdfMoney } from "@/lib/pdfFormatting";
import { productAttribution } from "@/lib/productAttribution";
import { AXIS_MATERIAL_KEY, type ViewingRoomChoice, type ViewingRoomSlot } from "@/lib/viewingRoom";
import { PROPOSAL_CLIENT_NAME_MAX, PROPOSAL_NOTES_MAX, proposalSelectedFinishes } from "@/lib/viewingRoomProposalData";

type PreviewFinish = { key: string; label: string; name: string; image_url: string | null };

function previewFinishes(piece: ViewingRoomChoice): PreviewFinish[] {
  const swatches: PreviewFinish[] = proposalSelectedFinishes(piece).map(finish => ({
    key: `${finish.axis}:${finish.id}`, label: finish.label, name: finish.name, image_url: finish.image_url,
  }));
  const coveredAxes = new Set(proposalSelectedFinishes(piece).map(finish => finish.axis));
  const sizeKey = piece.size_key ?? piece.size_options[0]?.key;
  const activeOption = piece.finish_options.find(option => option.key === piece.finish_key)
    ?? piece.finish_options.find(option => option.size_key === sizeKey && option.retail_price === piece.retail_price);
  for (const axis of activeOption?.axes ?? []) {
    const materialKey = AXIS_MATERIAL_KEY[axis.role];
    if (!axis.value || coveredAxes.has(materialKey)) continue;
    swatches.push({
      key: `axis:${axis.role}`,
      label: axis.label,
      name: /com|customer/i.test(axis.value) ? "Customer’s own material" : `${axis.value} (colour on request)`,
      image_url: null,
    });
  }
  if (!swatches.length && activeOption?.label) {
    swatches.push({ key: `option:${activeOption.key}`, label: "Selected finish", name: activeOption.label, image_url: null });
  }
  return swatches;
}

export default function ViewingRoomProposalPreview({ open, onOpenChange, tierName, residence, developer, currency, slots, choices, total, busy, locked, feedback, clientName, projectNotes, onClientNameChange, onProjectNotesChange, onConfirm, canExportBlenderScene = false, exportingBlender = false, onExportBlender, stageInVisualiserHref }: {
  open: boolean; onOpenChange: (open: boolean) => void; tierName?: string; residence: string; developer: string; currency: string;
  slots: ViewingRoomSlot[]; choices: Record<string, ViewingRoomChoice>; total: number; busy: boolean; locked: boolean; feedback: string;
  clientName: string; projectNotes: string; onClientNameChange: (value: string) => void; onProjectNotesChange: (value: string) => void; onConfirm: () => void;
  canExportBlenderScene?: boolean; exportingBlender?: boolean; onExportBlender?: () => void; stageInVisualiserHref?: string;
}) {
  const money = (value: number) => formatPdfMoney(Math.round(value * 100), currency);
  const selectedItems = slots.map(slot => ({ slot, piece: choices[slot.id] ?? slot }));
  const hasUnpriced = selectedItems.some(({ piece }) => piece.retail_price == null);
  const heading = tierName ? `${tierName} Collection` : "Selected Collection";
  const trimmedClient = clientName.trim();
  return <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
    <DialogContent className="viewing-room flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-none border-border bg-background p-0 text-foreground">
      <div className="border-b border-border py-5 pl-12 pr-6 sm:px-6 sm:pr-12">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{locked ? "Locked Proposal Summary" : "Proposal Preview"}</p>
        <DialogTitle className="mt-1 font-display text-2xl font-normal">{heading}</DialogTitle>
        <DialogDescription className="mt-1 text-xs text-muted-foreground">{residence} · {developer} · {selectedItems.length} {selectedItems.length === 1 ? "piece" : "pieces"}</DialogDescription>
        {trimmedClient && <p className="mt-1.5 text-xs text-foreground">Prepared for {trimmedClient}</p>}
      </div>
      <div aria-label="Proposal pieces" className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-6">
        <div className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="proposal-client-name" className="text-xs font-normal text-muted-foreground">Client name (optional)</Label>
            <Input id="proposal-client-name" value={clientName} maxLength={PROPOSAL_CLIENT_NAME_MAX} disabled={busy || locked} placeholder="e.g. Mr & Mrs Laurent" className="rounded-none bg-background text-sm" onChange={event => onClientNameChange(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal-project-notes" className="text-xs font-normal text-muted-foreground">Project notes (optional)</Label>
            <Textarea id="proposal-project-notes" value={projectNotes} maxLength={PROPOSAL_NOTES_MAX} rows={2} disabled={busy || locked} placeholder="Delivery timing, preferred tones, or residence notes for the PDF" className="min-h-16 resize-y rounded-none bg-background text-sm" onChange={event => onProjectNotesChange(event.target.value)} />
          </div>
        </div>
        {selectedItems.map(({ slot, piece }) => {
          const attribution = productAttribution({ title: piece.product_name, brandName: piece.brand_name });
          const finishes = previewFinishes(piece);
          const dimensions = piece.dimensions || (piece.width_mm && piece.depth_mm && piece.height_mm ? `W ${piece.width_mm} × D ${piece.depth_mm} × H ${piece.height_mm} mm` : null);
          return <article key={slot.id} aria-label={piece.product_name} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
            <div className="flex aspect-square items-center justify-center bg-muted/40 p-2">
              {piece.image_url ? <img src={piece.image_url} alt={piece.product_name} className="size-full object-contain" /> : <span className="text-center text-[10px] text-muted-foreground">Image pending</span>}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h3 className="font-display text-lg leading-snug">{attribution.title}</h3>
                  {attribution.designer && <p className="text-xs text-muted-foreground">{attribution.designer}</p>}
                </div>
                <p className="text-sm">{piece.retail_price == null ? "Price to be confirmed" : `${piece.retail_price_from ? "From " : ""}${money(piece.retail_price)}`}</p>
              </div>
              {piece.id !== slot.id && <p className="text-xs text-muted-foreground">Swapped from {slot.product_name}</p>}
              <p className="text-xs text-muted-foreground">{dimensions ? `${dimensions} · ` : ""}Lead time · {piece.lead_time ?? "To be confirmed"}</p>
              {finishes.length > 0 ? <ul className="space-y-1.5 pt-1">{finishes.map(finish => <li key={finish.key} className="flex items-center gap-2 text-xs">
                {finish.image_url ? <span className="size-5 shrink-0 overflow-hidden rounded-full border border-border"><img src={finish.image_url} alt={finish.name} className="size-full object-cover" /></span> : <span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-border bg-muted/50" />}
                <span className="min-w-0 text-muted-foreground"><span className="text-foreground">{finish.label}:</span> {finish.name}</span>
              </li>)}</ul> : <p className="text-xs text-muted-foreground">Selected finishes as curated</p>}
            </div>
          </article>;
        })}
      </div>
      <div className="space-y-3 border-t border-border bg-background px-6 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs text-muted-foreground">Live Collection Total</p>
          <p aria-label="Preview Collection Total" className="font-display text-2xl">{money(total)}</p>
        </div>
        {hasUnpriced && <p role="status" className="text-xs text-muted-foreground">Pieces marked “Price to be confirmed” are excluded from the total; your advisor will confirm them separately.</p>}
        {feedback && <p role="status" className="text-xs text-muted-foreground">{feedback}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={busy || exportingBlender} onClick={() => onOpenChange(false)}>Back to Collection</Button>
          {locked && canExportBlenderScene && stageInVisualiserHref && (
            <Button asChild variant="outline">
              <a href={stageInVisualiserHref}>
                <Layers className="size-4 shrink-0" />
                Stage in Visualiser
              </a>
            </Button>
          )}
          {locked && canExportBlenderScene && onExportBlender && (
            <Button variant="outline" disabled={busy || exportingBlender} onClick={onExportBlender}>
              <FileJson className="size-4 shrink-0" />
              {exportingBlender ? "Exporting Blender JSON…" : "Export Blender Scene JSON"}
            </Button>
          )}
          <Button disabled={busy || exportingBlender || !selectedItems.length} onClick={onConfirm}>
            <Lock className="size-4 shrink-0" />
            {busy ? "Locking & preparing PDF…" : locked ? "Download Locked Proposal" : "Lock & Download Proposal"}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}