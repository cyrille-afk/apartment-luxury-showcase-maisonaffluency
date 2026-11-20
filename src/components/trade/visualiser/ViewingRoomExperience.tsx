import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Product3DViewer from "../Product3DViewer";
import { Product3dBadge } from "../Product3dBadge";
import { MoodBoardBudgetBar } from "../MoodBoardBudgetControls";
import { getViewingRoomChoices, lockViewingRoomProposal } from "@/lib/viewingRoom.functions";
import { viewingRoomTotal, viewingRoomSelection, type ViewingRoomChoice, type ViewingRoomSlot } from "@/lib/viewingRoom";
import { moodBudgetLedger, isMoodCurrency } from "@/lib/moodBoardBudget";
import { downloadViewingRoomProposal } from "@/lib/viewingRoomProposal";
import { formatPdfMoney } from "@/lib/pdfFormatting";

export default function ViewingRoomExperience({ token, packageId, baseTotal, currency, residence, developer, onTotal }: {
  token: string; packageId: string; baseTotal: number; currency: string; residence: string; developer: string; onTotal: (total: number) => void;
}) {
  const query = useQuery({ queryKey: ["viewing-room-choices", token, packageId], queryFn: () => getViewingRoomChoices({ data: { token, packageId } }), retry: false });
  const [choices, setChoices] = useState<Record<string, ViewingRoomChoice>>({});
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViewingRoomChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const key = useRef<string | null>(null);
  const snapshot = useRef<Awaited<ReturnType<typeof lockViewingRoomProposal>> | null>(null);
  const lock = useServerFn(lockViewingRoomProposal);
  const slots = query.data?.items ?? [];
  const current = slots.find(slot => slot.id === active);
  const items = useMemo(() => (query.data?.items ?? []).map(slot => ({ ...(choices[slot.id] ?? slot), id: slot.id })), [query.data, choices]);
  const total = viewingRoomTotal(baseTotal, slots, choices);
  const ledger = moodBudgetLedger(items.map(item => ({ id: item.id, product_name: item.product_name })), new Map(items.map(item => [item.id, { retail: item.retail_price == null ? null : Math.round(item.retail_price * 100), trade: null }])), { roomType: "living", totalEur: baseTotal, caps: {}, anchors: [] });
  const money = (value: number) => formatPdfMoney(Math.round(value * 100), currency);
  const openPiece = (slot: ViewingRoomSlot) => { setActive(slot.id); setDraft(choices[slot.id] ?? slot); };
  useEffect(() => { onTotal(total); }, [total]);
  async function requestProposal() {
    setBusy(true); setFeedback("");
    try {
      key.current ??= crypto.randomUUID();
      const final = snapshot.current ?? await lock({ data: { token, packageId, requestKey: key.current, choices: slots.map(slot => ({ slot_id: slot.id, product_id: choices[slot.id]?.id ?? slot.id, finish_key: choices[slot.id]?.finish_key })) } });
      snapshot.current = final; setLocked(true);
      await downloadViewingRoomProposal(final, residence, developer);
      setFeedback("Selection locked · proposal requested and PDF downloaded.");
    } catch { setFeedback(snapshot.current ? "Selection locked. PDF download failed; please retry." : "Your proposal couldn’t be locked. Please try again."); }
    finally { setBusy(false); }
  }
  if (query.isPending) return <p role="status" className="p-12 text-muted-foreground">Preparing your collection…</p>;
  if (query.isError || !query.data) return <div role="alert" className="p-12"><p>Your collection choices couldn’t load.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>;
  const proposalButton = <Button className="max-w-48 whitespace-normal text-xs sm:max-w-none sm:text-sm" disabled={busy || !slots.length} onClick={() => void requestProposal()}><Lock className="size-4 shrink-0" />{busy ? "Preparing proposal…" : locked ? "Download Locked Proposal" : "Lock & Download Proposal"}</Button>;
  return <div className="viewing-room bg-background pb-28 text-foreground">
    <div className="mx-auto max-w-[1500px] px-6 pt-6 md:px-12">
      {isMoodCurrency(currency) && <section aria-label="Budget Allocation"><MoodBoardBudgetBar ledger={ledger} pending={false} currency={currency} /></section>}
      <div aria-label="Client editorial collection" className="grid grid-cols-1 gap-x-8 gap-y-12 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map(slot => { const piece = choices[slot.id] ?? slot; return <article key={slot.id} className="flex min-w-0 flex-col" aria-label={piece.product_name}>
          <div className="relative aspect-[4/5] bg-muted/40">
            <Product3dBadge glbUrl={piece.glb_url} productName={piece.product_name} onOpen={() => openPiece(slot)} className="left-3 top-3 z-10" />
            <Button variant="ghost" aria-label={`Materials and finishes for ${piece.product_name}`} onClick={() => openPiece(slot)} className="h-full w-full rounded-none p-6 hover:bg-transparent">{piece.image_url ? <img src={piece.image_url} alt={piece.product_name} className="h-full w-full object-contain" loading="lazy" /> : <span className="text-muted-foreground">Image pending</span>}</Button>
            {slot.is_swappable && <Button size="icon" variant="outline" className="absolute bottom-3 right-3 rounded-full" aria-label={`Curated alternatives for ${piece.product_name}`} onClick={() => openPiece(slot)}><Plus className="size-4" /></Button>}
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-3"><h2 className="font-display text-xl">{piece.product_name}</h2>
            <div className="flex min-h-6 flex-wrap gap-2">{Object.values(piece.materials).map(material => <span key={material.id} title={material.name} className="size-6 shrink-0 overflow-hidden rounded-full border border-border">{material.image_url && <img src={material.image_url} alt={material.name} className="size-full object-cover" />}</span>)}</div>
            {piece.finish_key && <p className="text-xs text-muted-foreground">{piece.finish_options.find(finish => finish.key === piece.finish_key)?.label}</p>}
            <div className="mt-auto"><p aria-label="Item price" className="text-sm">{piece.retail_price == null ? "Price to be confirmed" : `${piece.retail_price_from ? "From " : ""}${money(piece.retail_price)}`}</p><p className="mt-1 text-xs text-muted-foreground">Lead time · {piece.lead_time ?? "To be confirmed"}</p></div>
          </div>
        </article>; })}
      </div>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border bg-background px-4 py-3 sm:flex sm:justify-between sm:px-6">
      <div><p className="text-xs text-muted-foreground">Selection Total</p><p className="font-display text-lg sm:text-2xl" aria-live="polite">{money(total)}</p></div>{proposalButton}
      {feedback && <p role="status" className="col-span-2 text-sm">{feedback}</p>}
    </div>
    <Sheet open={!!current && !!draft} onOpenChange={open => { if (!open) { setActive(null); setDraft(null); } }}>
      <SheetContent className="viewing-room flex w-full flex-col overflow-y-auto bg-background text-foreground sm:max-w-lg" side="right">
        <p className="pr-8 text-[10px] uppercase text-muted-foreground">Materials &amp; Finishes Library</p>
        <SheetTitle className="pr-8 font-display text-2xl">{draft?.product_name}</SheetTitle><SheetDescription>{draft?.dimensions ?? "Dimensions to be confirmed"}</SheetDescription>
        {draft && current && <>
          {draft.glb_url ? <Product3DViewer key={draft.id} url={draft.glb_url} alt={draft.product_name} poster={draft.image_url} autoOpen autoRotate={false} clientEditorial baseTextureUrl={draft.materials.base?.image_url} topTextureUrl={draft.materials.top?.image_url} fabricTextureUrl={draft.materials.upholstery?.image_url} /> : draft.image_url && <img src={draft.image_url} alt={draft.product_name} className="aspect-[4/3] w-full object-contain" />}
          <div className="space-y-4 py-4">
            {current.allow_finish_customization && draft.finish_options.length ? <div className="space-y-2"><p className="text-xs text-muted-foreground">Upholstery &amp; frame finish</p><Select value={draft.finish_key ?? "original"} disabled={busy || locked || current.retail_price == null} onValueChange={value => setDraft(viewingRoomSelection(current, draft.id, value === "original" ? undefined : value))}><SelectTrigger aria-label="Finish selection" className="h-auto min-h-10 whitespace-normal"><SelectValue placeholder="Selected finishes" /></SelectTrigger><SelectContent><SelectItem value="original">Selected finishes</SelectItem>{draft.finish_options.map(finish => <SelectItem key={finish.key} value={finish.key}>{finish.label} · {money(finish.retail_price)}</SelectItem>)}</SelectContent></Select></div> : <p className="text-sm text-muted-foreground">{current.allow_finish_customization ? "Additional finishes are being curated for this piece." : "This piece is presented in its selected finishes."}</p>}
            <div className="flex flex-wrap gap-3">{Object.values(draft.materials).map(material => <figure key={material.id} className="max-w-28">{material.image_url && <img src={material.image_url} alt={material.name} className="size-10 rounded-full object-cover" />}<figcaption className="mt-2 text-xs">{material.name}</figcaption></figure>)}</div>
            <p className="font-display text-xl">{draft.retail_price == null ? "Price to be confirmed" : `${draft.retail_price_from ? "From " : ""}${money(draft.retail_price)}`}</p>
            <p className="text-xs text-muted-foreground">Lead time · {draft.lead_time ?? "To be confirmed"}</p>
          </div>
          {current.is_swappable && <section className="border-t border-border pt-4"><h3 className="font-display text-lg">Curated Alternatives</h3>{current.alternatives.map(option => <Button key={option.id} variant="outline" disabled={busy || locked || current.retail_price == null || option.retail_price == null} aria-pressed={draft.id === option.id} className="my-3 h-auto w-full justify-start gap-4 whitespace-normal p-3 text-left" onClick={() => setDraft(viewingRoomSelection(current, option.id))}>{option.image_url && <img src={option.image_url} alt="" className="size-16 object-contain" />}<span className="min-w-0"><span className="block font-display">{option.product_name}</span><span className="mt-1 block text-xs">{option.retail_price == null ? "Price to be confirmed" : money(option.retail_price)}</span></span></Button>)}{draft.id !== current.id && <Button variant="ghost" disabled={busy || locked} onClick={() => setDraft(current)}>Restore original piece</Button>}</section>}
          <div className="sticky bottom-0 mt-auto border-t border-border bg-background py-4"><Button className="w-full" disabled={busy || locked} onClick={() => { setChoices(values => ({ ...values, [current.id]: viewingRoomSelection(current, draft.id, draft.finish_key) })); setActive(null); setDraft(null); }}>UPDATE SELECTION</Button></div>
        </>}
      </SheetContent>
    </Sheet>
  </div>;
}
