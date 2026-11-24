import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, ArrowLeftRight, RotateCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Product3DViewer from "../Product3DViewer";
import ViewingRoomAxisFinishes from "./ViewingRoomAxisFinishes";
import { Product3dBadge } from "../Product3dBadge";
import { MoodBoardBudgetBar } from "../MoodBoardBudgetControls";
import { getViewingRoomChoices, lockViewingRoomProposal } from "@/lib/viewingRoom.functions";
import { viewingRoomTotal, viewingRoomSelection, viewingRoomSizeSelection, viewingRoomViewerMaterials, type ViewingRoomChoice, type ViewingRoomSlot, type ViewingRoomItem } from "@/lib/viewingRoom";
import { moodBudgetLedger, isMoodCurrency } from "@/lib/moodBoardBudget";
import { downloadViewingRoomProposal } from "@/lib/viewingRoomProposal";
import { formatPdfMoney } from "@/lib/pdfFormatting";
import { viewingRoomSwapsEnabled } from "@/lib/viewingRoomAlternatives";
import type { ViewingRoomProposalContext } from "@/lib/viewingRoomProposalData";
import { readArViewerHandoff } from "@/lib/arViewerHandoff";

export default function ViewingRoomExperience({ token, packageId, baseTotal, currency, residence, developer, onTotal, fallbackItems = [], proposalContext = {} }: {
  token: string; packageId: string; baseTotal: number; currency: string; residence: string; developer: string; onTotal: (total: number) => void; fallbackItems?: ViewingRoomItem[]; proposalContext?: ViewingRoomProposalContext;
}) {
  const query = useQuery({ queryKey: ["viewing-room-choices", token, packageId], queryFn: () => getViewingRoomChoices({ data: { token, packageId } }), retry: false });
  const [choices, setChoices] = useState<Record<string, ViewingRoomChoice>>({});
  const [previousPieces, setPreviousPieces] = useState<Record<string, ViewingRoomChoice>>({});
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViewingRoomChoice | null>(null);
  const [drawerTab, setDrawerTab] = useState("finishes");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const key = useRef<string | null>(null);
  const snapshot = useRef<Awaited<ReturnType<typeof lockViewingRoomProposal>> | null>(null);
  const arRestored = useRef<string | null>(null);
  const lock = useServerFn(lockViewingRoomProposal);
  const slots = useMemo<ViewingRoomSlot[]>(() => query.data
    ? query.data.items.map(slot => ({ ...slot, is_swappable: viewingRoomSwapsEnabled(slot.is_swappable, query.data?.allow_alternatives ?? false) }))
    : fallbackItems.map(item => ({ ...item, retail_price: null, retail_price_from: false, finish_options: [], size_options: [], alternatives: [], is_swappable: false, allow_finish_customization: false })), [query.data, fallbackItems]);
  const recommendationsUnavailable = query.isError || (!query.isPending && !query.data);
  const current = slots.find(slot => slot.id === active);
  // Server validates each candidate against the slot's saved footprint overrides.
  const alternatives = current?.alternatives ?? [];
  const items = useMemo(() => slots.map(slot => ({ ...(choices[slot.id] ?? slot), id: slot.id })), [slots, choices]);
  const total = viewingRoomTotal(baseTotal, slots, choices);
  const ledger = moodBudgetLedger(items.map(item => ({ id: item.id, product_name: item.product_name })), new Map(items.map(item => [item.id, { retail: item.retail_price == null ? null : Math.round(item.retail_price * 100), trade: null }])), { roomType: "living", totalEur: baseTotal, caps: {}, anchors: [] });
  const money = (value: number) => formatPdfMoney(Math.round(value * 100), currency);
  // A drawer opened before choices loaded holds the read-only fallback piece; adopt the loaded slot once it arrives.
  useEffect(() => { if (query.data && current && draft && draft.id === current.id && !choices[current.id] && draft.finish_options.length === 0 && current.finish_options.length > 0) setDraft(current); }, [query.data, current, draft, choices]);
  const openPiece = (slot: ViewingRoomSlot, tab = "finishes") => { setActive(slot.id); setDraft(choices[slot.id] ?? slot); setDrawerTab(tab); };
  useEffect(() => {
    if (!query.data) return;
    const handoff = readArViewerHandoff(window.location.href);
    if (!handoff || handoff.kind !== "viewing-room" || handoff.context !== packageId) return;
    const key = JSON.stringify(handoff);
    if (arRestored.current === key) return;
    const slot = slots.find(row => row.id === handoff.id);
    if (!slot) return;
    arRestored.current = key;
    try {
      const restored = viewingRoomSelection(slot, handoff.product ?? slot.id, handoff.finish, handoff.size, handoff.colour, handoff.axes);
      setActive(slot.id); setDraft(restored); setDrawerTab("finishes");
    } catch { setFeedback("This shared finish is no longer available. Your collection is unchanged."); }
  }, [query.data, slots, packageId]);
  const selectAlternative = (slot: ViewingRoomSlot, productId: string) => {
    if (busy || locked) return;
    const previous = choices[slot.id] ?? slot;
    if (previous.id === productId) return;
    const selection = viewingRoomSelection(slot, productId);
    setPreviousPieces(values => ({ ...values, [slot.id]: structuredClone(previous) }));
    setChoices(values => ({ ...values, [slot.id]: selection }));
    setDraft(selection); setDrawerTab("finishes");
  };
  const undoSwap = (slot: ViewingRoomSlot) => {
    const previous = previousPieces[slot.id];
    if (!previous || busy || locked || !query.data) return;
    try {
      const restored = viewingRoomSelection(slot, previous.id, previous.finish_key, previous.size_key, previous.colourway_id, previous.axis_colours);
      setChoices(values => ({ ...values, [slot.id]: restored }));
      setPreviousPieces(({ [slot.id]: _previous, ...rest }) => rest);
      if (active === slot.id) { setDraft(restored); setDrawerTab("finishes"); }
      setFeedback(`Restored ${restored.product_name}.`);
    } catch { setFeedback("This previous selection is no longer available. Your current piece is unchanged."); }
  };
  const undoButton = (slot: ViewingRoomSlot) => previousPieces[slot.id] && !locked ? <Button variant="ghost" disabled={busy || !query.data} className="h-auto justify-start gap-2 self-start px-0 py-2 text-xs" aria-label={`Undo swap — restore ${previousPieces[slot.id].product_name}`} onClick={() => undoSwap(slot)}><Undo2 className="size-4" />Undo Swap</Button> : null;
  useEffect(() => { onTotal(total); }, [total]);
  async function requestProposal() {
    setBusy(true); setFeedback("");
    try {
      key.current ??= crypto.randomUUID();
      const final = snapshot.current ?? await lock({ data: { token, packageId, requestKey: key.current, choices: slots.map(slot => ({ slot_id: slot.id, product_id: choices[slot.id]?.id ?? slot.id, finish_key: choices[slot.id]?.finish_key, size_key: choices[slot.id]?.size_key, colourway_id: choices[slot.id]?.colourway_id, axis_colours: choices[slot.id]?.axis_colours })) } });
      snapshot.current = final; setLocked(true);
      const presentation = { ...final, items: final.items.map((item, index) => {
        const slot = slots[index];
        const approved = slot?.product_name === item.product_name ? slot : slot?.alternatives.find(piece => piece.product_name === item.product_name);
        return { ...item, image_url: item.image_url ?? approved?.image_url ?? null };
      }) };
      await downloadViewingRoomProposal(presentation, residence, developer, proposalContext);
      setFeedback("Selection locked · proposal requested and PDF downloaded.");
    } catch { setFeedback(snapshot.current ? "Selection locked. PDF download failed; please retry." : "Your proposal couldn’t be locked. Please try again."); }
    finally { setBusy(false); }
  }
  if (query.isPending && !slots.length) return <p role="status" className="p-12 text-muted-foreground">Preparing your collection…</p>;
  const retryButton = <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RotateCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />{query.isFetching ? "Retrying…" : "Retry recommendations"}</Button>;
  const proposalButton = <Button className="max-w-48 whitespace-normal text-xs sm:max-w-none sm:text-sm" disabled={busy || !slots.length || !query.data} onClick={() => void requestProposal()}><Lock className="size-4 shrink-0" />{busy ? "Preparing proposal…" : locked ? "Download Locked Proposal" : "Lock & Download Proposal"}</Button>;
  return <div className="viewing-room bg-background pb-28 text-foreground">
    <div className="mx-auto max-w-[1500px] px-6 pt-6 md:px-12">
      {recommendationsUnavailable && <div role="status" className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6"><div className="max-w-xl"><p className="font-display text-xl">Recommendations are temporarily unavailable</p><p className="mt-2 text-sm text-muted-foreground">Your collection is still here. You can inspect its pieces and selected materials while we reconnect.{!query.data && " Finish changes and confirmed totals will return when recommendations load."}</p></div>{retryButton}</div>}
      {query.data && isMoodCurrency(currency) && <section aria-label="Budget Allocation"><MoodBoardBudgetBar ledger={ledger} pending={false} currency={currency} /></section>}
      <div aria-label="Client editorial collection" className="grid grid-cols-1 gap-x-8 gap-y-12 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map(slot => { const piece = choices[slot.id] ?? slot; return <article key={slot.id} className="flex min-w-0 flex-col" aria-label={piece.product_name}>
          <div className="relative aspect-[4/5] bg-muted/40">
            <Product3dBadge glbUrl={piece.glb_url} productName={piece.product_name} onOpen={() => openPiece(slot)} className="left-3 top-3 z-10" />
            <Button variant="ghost" aria-label={`Materials and finishes for ${piece.product_name}`} onClick={() => openPiece(slot)} className="h-full w-full rounded-none p-6 hover:bg-transparent">{piece.image_url ? <img src={piece.image_url} alt={piece.product_name} className="h-full w-full object-contain" loading="lazy" /> : <span className="text-muted-foreground">Image pending</span>}</Button>
            {slot.is_swappable && <Button variant="outline" disabled={busy || locked} className="absolute right-3 top-3 z-10 h-auto gap-1.5 rounded-none border-border/60 bg-background/85 px-2.5 py-1.5 text-[10px] uppercase backdrop-blur-sm" aria-label={`Swap piece — ${piece.product_name}`} onClick={() => openPiece(slot, "alternatives")}><ArrowLeftRight className="size-3.5" strokeWidth={1.5} />SWAP PIECE</Button>}
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-3"><h2 className="font-display text-xl">{piece.product_name}</h2>
            <div className="flex min-h-6 flex-wrap gap-2">{[...new Map(Object.values(piece.materials).map(material => [material.id, material])).values()].map(material => <span key={material.id} title={material.name} className="size-6 shrink-0 overflow-hidden rounded-full border border-border">{material.image_url && <img src={material.image_url} alt={material.name} className="size-full object-cover" />}</span>)}</div>
            {piece.finish_key && <p className="text-xs text-muted-foreground">{piece.finish_options.find(finish => finish.key === piece.finish_key)?.label}</p>}
            {piece.size_key && <p className="text-xs text-muted-foreground">{piece.dimensions}</p>}
            <div className="mt-auto"><p aria-label="Item price" className="text-sm">{piece.retail_price == null ? "Price to be confirmed" : `${piece.retail_price_from ? "From " : ""}${money(piece.retail_price)}`}</p><p className="mt-1 text-xs text-muted-foreground">Lead time · {piece.lead_time ?? "To be confirmed"}</p></div>
            {undoButton(slot)}
          </div>
        </article>; })}
      </div>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border bg-background px-4 py-3 sm:flex sm:justify-between sm:px-6">
      <div><p className="text-xs text-muted-foreground">Collection Total</p><p className="font-display text-lg sm:text-2xl" aria-label="Collection Total" aria-live="polite">{query.data ? money(ledger.allocated / 100) : "Awaiting confirmed prices"}</p></div>{proposalButton}
      {feedback && <p role="status" className="col-span-2 text-sm">{feedback}</p>}
    </div>
    <Sheet open={!!current && !!draft} onOpenChange={open => { if (!open) { setActive(null); setDraft(null); } }}>
      <SheetContent className="viewing-room flex w-full flex-col overflow-y-auto bg-background text-foreground sm:max-w-lg" side="right">
        <p className="pr-8 text-[10px] uppercase text-muted-foreground">Materials &amp; Finishes Library</p>
        <SheetTitle className="pr-8 font-display text-2xl">{draft?.product_name}</SheetTitle><SheetDescription>{draft?.dimensions ?? "Dimensions to be confirmed"}</SheetDescription>
        {draft && current && <>
          <Tabs value={drawerTab} onValueChange={setDrawerTab} className="min-w-0 shrink-0">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b border-border bg-transparent p-0"><TabsTrigger value="finishes" className="whitespace-normal rounded-none px-2 py-3 text-xs">3D &amp; Finishes</TabsTrigger><TabsTrigger value="alternatives" className="whitespace-normal rounded-none px-2 py-3 text-xs">Curated Alternatives</TabsTrigger></TabsList>
          <TabsContent value="finishes" className="pt-4">
          {draft.glb_url ? <Product3DViewer key={draft.id} url={draft.glb_url} alt={draft.product_name} arHandoff={{ kind: "viewing-room", id: current.id, context: packageId, product: draft.id, ...(draft.finish_key ? { finish: draft.finish_key } : {}), ...(draft.size_key ? { size: draft.size_key } : {}), ...(draft.colourway_id ? { colour: draft.colourway_id } : {}), ...(draft.axis_colours ? { axes: draft.axis_colours } : {}) }} furnitureCategory={`${draft.category ?? ""} ${draft.subcategory ?? ""}`} furnitureDimensions={draft.width_mm && draft.depth_mm && draft.height_mm ? { width: draft.width_mm, depth: draft.depth_mm, height: draft.height_mm } : undefined} poster={draft.image_url} autoOpen autoRotate={false} clientEditorial {...(() => { const shown = viewingRoomViewerMaterials(draft); return { fabricLabel: shown.upholstery?.name, backrestFabricLabel: shown["backrest"]?.name, baseTextureUrl: shown.base?.image_url, topTextureUrl: shown.top?.image_url, fabricTextureUrl: shown.upholstery?.image_url, backrestTextureUrl: shown["backrest"]?.image_url }; })()} {...(draft.material_roles ? { materialRoles: draft.material_roles } : {})} /> : draft.image_url && <img src={draft.image_url} alt={draft.product_name} className="aspect-[4/3] w-full object-contain" />}
          <div className="space-y-4 py-4">
            {current.allow_finish_customization && draft.size_options.length > 0 && <div className="space-y-2"><p className="text-xs text-muted-foreground">Size</p><Select value={draft.size_key ?? "original"} disabled={busy || locked || current.retail_price == null} onValueChange={value => setDraft(value === "original" ? viewingRoomSelection(current, draft.id) : viewingRoomSizeSelection(current, draft, value))}><SelectTrigger aria-label={/sofa|settee/i.test(draft.product_name) ? "Sofa size" : "Size"} className="h-auto min-h-10 whitespace-normal"><SelectValue placeholder="Choose exact size" /></SelectTrigger><SelectContent><SelectItem value="original">Original selection</SelectItem>{draft.size_options.map(size => <SelectItem key={size.key} value={size.key}>{size.label}</SelectItem>)}</SelectContent></Select></div>}
            {(() => { const finishDisabled = busy || locked || current.retail_price == null || (draft.size_options.length > 0 && !draft.size_key); const available = draft.finish_options.filter(finish => finish.size_key === draft.size_key); const split = available.map(finish => finish.label.split(" / ")); const paired = available.length > 1 && split.every(parts => parts.length === 2); const choose = (value: string) => setDraft(viewingRoomSelection(current, draft.id, value === "original" ? undefined : value, value === "original" ? undefined : draft.size_key));
              const axisOptions = available.filter(finish => (finish.axes ?? []).length > 0);
              if (current.allow_finish_customization && axisOptions.length > 0 && axisOptions.length === available.length) {
                return <ViewingRoomAxisFinishes slot={current} draft={draft} disabled={finishDisabled} onChange={setDraft} />;
              }
              if (current.allow_finish_customization && paired) { const selected = available.findIndex(finish => finish.key === draft.finish_key); const [top, base] = selected >= 0 ? (split[selected] ?? []) : [undefined, undefined]; const tops = [...new Set(split.map(parts => (parts[0] ?? "")))]; const bases = [...new Set(split.map(parts => (parts[1] ?? "")))]; const pick = (nextTop: string | undefined, nextBase: string | undefined) => { const index = split.findIndex(parts => parts[0] === (nextTop ?? tops[0]) && parts[1] === (nextBase ?? bases[0])); const fallbackIndex = index >= 0 ? index : split.findIndex(parts => parts[0] === nextTop || parts[1] === nextBase); if (fallbackIndex >= 0) choose(available[fallbackIndex]?.key ?? "original"); }; const priceFor = (nextTop: string) => { const index = split.findIndex(parts => parts[0] === nextTop && parts[1] === (base ?? bases[0])); return index >= 0 ? ` · ${money(available[index]?.retail_price ?? 0)}` : ""; };
                const topCat = available[0]?.materials["top"]?.category ?? "", baseCat = available[0]?.materials["base"]?.category ?? ""; const topTitle = /stone|marble/i.test(topCat) ? "Stone finish" : "Upholstery", baseTitle = /wood/i.test(baseCat) && topTitle !== "Upholstery" ? "Wood finish" : "Frame finish";
                return <div className="space-y-3"><div className="space-y-2"><p className="text-xs text-muted-foreground">{topTitle}</p><Select value={top ?? ""} disabled={finishDisabled} onValueChange={value => pick(value, base)}><SelectTrigger aria-label={topTitle} className="h-auto min-h-10 whitespace-normal"><SelectValue placeholder={`Selected ${topTitle.toLowerCase()}`} /></SelectTrigger><SelectContent>{tops.map(value => <SelectItem key={value} value={value}><span className="flex items-center gap-2">{available.find(finish => finish.label.split(" / ")[0] === value)?.materials["top"]?.image_url && <img src={available.find(finish => finish.label.split(" / ")[0] === value)?.materials["top"]?.image_url ?? ""} alt="" className="size-5 shrink-0 rounded-full object-cover" />}{value}{priceFor(value)}</span></SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><p className="text-xs text-muted-foreground">{baseTitle}</p><Select value={base ?? ""} disabled={finishDisabled} onValueChange={value => pick(top, value)}><SelectTrigger aria-label={baseTitle} className="h-auto min-h-10 whitespace-normal"><SelectValue placeholder={`Selected ${baseTitle.toLowerCase()}`} /></SelectTrigger><SelectContent>{bases.map(value => <SelectItem key={value} value={value}><span className="flex items-center gap-2">{available.find(finish => finish.label.split(" / ")[1] === value)?.materials["base"]?.image_url && <img src={available.find(finish => finish.label.split(" / ")[1] === value)?.materials["base"]?.image_url ?? ""} alt="" className="size-5 shrink-0 rounded-full object-cover" />}{value}</span></SelectItem>)}</SelectContent></Select></div>{draft.finish_key && !draft.size_key && <Button variant="ghost" className="h-auto px-0 text-xs" disabled={finishDisabled} onClick={() => choose("original")}>Return to selected finishes</Button>}</div>; }
              const sizeKey = draft.size_key ?? draft.size_options[0]?.key; const ranges = draft.finish_options.filter(finish => finish.size_key === sizeKey);
              const allCats = draft.finish_options.flatMap(finish => [...Object.values(finish.materials).map(m => m.category), ...(finish.colourways ?? []).map(c => c.category)]);
              const isTextile = allCats.some(c => /fabric|leather|upholster/i.test(c)) || ranges.some(f => /fabric|leather|velvet|\bcom\b/i.test(f.label));
              const finishTitle = isTextile ? "Upholstery" : allCats.some(c => /stone|marble/i.test(c)) ? "Finish" : allCats.some(c => /wood/i.test(c)) ? "Wood finish" : "Upholstery";
              const shown = viewingRoomViewerMaterials(draft);
              const activeFinish = ranges.find(finish => finish.key === draft.finish_key);
              const activeColour = draft.colourway_id ?? activeFinish?.colourways?.[0]?.id ?? "";
              return current.allow_finish_customization && ranges.length ? <div className="space-y-2"><p className="text-xs text-muted-foreground">{finishTitle} ({ranges.reduce((n, finish) => n + Math.max((finish.colourways ?? []).length, 1), 0)})</p><Select value={draft.finish_key ? `${draft.finish_key}|${activeColour}` : ""} disabled={busy || locked || current.retail_price == null} onValueChange={value => { const [key, colour] = value.split("|"); setDraft(viewingRoomSelection(current, draft.id, key, sizeKey, colour || undefined)); }}><SelectTrigger aria-label={finishTitle} className="h-auto min-h-10 whitespace-normal"><SelectValue placeholder={isTextile ? (shown.upholstery?.name ?? "Selected upholstery") : (shown.top?.name ?? shown.base?.name ?? "Selected finish")} /></SelectTrigger><SelectContent>{ranges.map(finish => <SelectGroup key={finish.key}><SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{finish.label} · {money(finish.retail_price)}</SelectLabel>{finish.colourways?.length ? finish.colourways.map(colour => <SelectItem key={colour.id} value={`${finish.key}|${colour.id}`}><span className="flex items-center gap-2">{colour.image_url && <img src={colour.image_url} alt="" className="size-5 rounded-full object-cover" />}{colour.name}</span></SelectItem>) : <SelectItem value={`${finish.key}|`}>{/com|customer/i.test(finish.label) ? "Customer's own material" : finish.label}</SelectItem>}</SelectGroup>)}</SelectContent></Select></div> : <p className="text-sm text-muted-foreground">{current.allow_finish_customization ? "Additional finishes are being curated for this piece." : "This piece is presented in its selected finishes."}</p>; })()}
            <p className="font-display text-xl">{draft.retail_price == null ? "Price to be confirmed" : `${draft.retail_price_from ? "From " : ""}${money(draft.retail_price)}`}</p>
            <p className="text-xs text-muted-foreground">Lead time · {draft.lead_time ?? "To be confirmed"}</p>
          </div>
          </TabsContent>
          <TabsContent value="alternatives" className="space-y-4 pt-4">
            {recommendationsUnavailable ? <div className="space-y-4"><p className="text-sm text-muted-foreground">We couldn’t refresh recommendations. Your current piece and selections are unchanged.</p>{retryButton}<Button variant="ghost" onClick={() => setDrawerTab("finishes")}>Return to materials &amp; finishes</Button></div> : !current.is_swappable ? <p className="text-sm text-muted-foreground">This piece is part of the fixed collection.</p> : !alternatives.length ? <div className="space-y-4"><p className="text-sm text-muted-foreground">No footprint-compatible alternatives are currently available. You can keep this piece and explore its selected materials.</p><Button variant="ghost" onClick={() => setDrawerTab("finishes")}>Return to materials &amp; finishes</Button></div> : alternatives.map(option => {
              const selectedPiece = choices[current.id] ?? current;
              const delta = option.retail_price != null && selectedPiece.retail_price != null ? option.retail_price - selectedPiece.retail_price : null;
              return <article key={option.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 border-b border-border py-4">
                {option.image_url ? <img src={option.image_url} alt={option.product_name} className="aspect-square w-20 object-contain" /> : <div className="size-20 bg-muted" />}
                <div className="min-w-0 space-y-2"><h3 className="font-display text-lg">{option.product_name}</h3><p className="text-xs text-muted-foreground">{option.dimensions ?? "Dimensions to be confirmed"}</p><p className="text-sm">{option.retail_price == null ? "Price to be confirmed" : `${option.retail_price_from ? "From " : ""}${money(option.retail_price)}`}</p>{delta != null && <span className="inline-block border border-border bg-muted/40 px-2 py-1 text-xs" aria-label="Price difference">{delta === 0 ? "Same price" : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta))}`}</span>}<Button variant="outline" className="h-auto w-full whitespace-normal py-2 text-xs" disabled={busy || locked || current.retail_price == null || option.retail_price == null || selectedPiece.id === option.id} onClick={() => selectAlternative(current, option.id)}>{selectedPiece.id === option.id ? "Selected" : "Select Alternative"}</Button></div>
              </article>;
            })}
            {current.is_swappable && (choices[current.id]?.id ?? current.id) !== current.id && <Button variant="ghost" disabled={busy || locked} onClick={() => selectAlternative(current, current.id)}>Restore original piece</Button>}
          </TabsContent>
          </Tabs>
          {query.data && <div className="sticky bottom-0 mt-auto border-t border-border bg-background py-4">{undoButton(current)}{drawerTab === "finishes" && <Button className="w-full" disabled={busy || locked || current.retail_price == null || draft.retail_price == null} onClick={() => { if (current.retail_price == null || draft.retail_price == null) return; setChoices(values => ({ ...values, [current.id]: viewingRoomSelection(current, draft.id, draft.finish_key, draft.size_key, draft.colourway_id, draft.axis_colours) })); setActive(null); setDraft(null); }}>UPDATE SELECTION</Button>}</div>}
        </>}
      </SheetContent>
    </Sheet>
  </div>;
}
