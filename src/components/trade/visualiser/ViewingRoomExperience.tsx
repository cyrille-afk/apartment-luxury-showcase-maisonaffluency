import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Box, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import Product3DViewer from "../Product3DViewer";
import ViewingRoomCanvas from "./ViewingRoomCanvas";
import { getViewingRoomChoices, lockViewingRoomProposal } from "@/lib/viewingRoom.functions";
import { viewingRoomTotal, type ViewingRoomChoice } from "@/lib/viewingRoom";
import { downloadViewingRoomProposal } from "@/lib/viewingRoomProposal";
import { formatPdfMoney } from "@/lib/pdfFormatting";

export default function ViewingRoomExperience({ token, packageId, baseTotal, currency, environmentUrl, residence, developer, onTotal }: {
  token: string; packageId: string; baseTotal: number; currency: string; environmentUrl: string | null; residence: string; developer: string; onTotal: (total: number) => void;
}) {
  const query = useQuery({ queryKey: ["viewing-room-choices", token, packageId], queryFn: () => getViewingRoomChoices({ data: { token, packageId } }), retry: false });
  const [choices, setChoices] = useState<Record<string, ViewingRoomChoice>>({});
  const [active, setActive] = useState<string | null>(null);
  const [inspect, setInspect] = useState(false);
  const [swatches, setSwatches] = useState(true);
  const [drawerTab, setDrawerTab] = useState("alternatives");
  const [materialRoles, setMaterialRoles] = useState<Record<string, "fabric" | "base" | "top" | "ignore">>({});
  const discoverMaterials = useCallback((names: string[]) => setMaterialRoles(Object.fromEntries(names.map(name => [name, /fabric|upholster|textile|leather|seat|cushion/i.test(name) ? "fabric" : /top|surface|tabletop/i.test(name) ? "top" : /wood|frame|leg|base|metal|structure/i.test(name) ? "base" : "ignore"]))), []);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const key = useRef<string | null>(null);
  const snapshot = useRef<Awaited<ReturnType<typeof lockViewingRoomProposal>> | null>(null);
  const lock = useServerFn(lockViewingRoomProposal);
  const slots = query.data?.items ?? [];
  const current = slots.find(slot => slot.id === active);
  const piece = current ? choices[current.id] ?? current : null;
  const items = useMemo(() => (query.data?.items ?? []).map(slot => ({ ...(choices[slot.id] ?? slot), id: slot.id })), [query.data, choices]);
  const total = viewingRoomTotal(baseTotal, slots, choices);
  const money = (value: number) => formatPdfMoney(Math.round(value * 100), currency);
  async function requestProposal() {
    setBusy(true); setFeedback("");
    try {
      key.current ??= crypto.randomUUID();
      const final = snapshot.current ?? await lock({ data: { token, packageId, requestKey: key.current, choices: slots.map(slot => ({ slot_id: slot.id, product_id: choices[slot.id]?.id ?? slot.id })) } });
      snapshot.current = final; setLocked(true);
      await downloadViewingRoomProposal(final, residence, developer);
      setFeedback("Selection locked · proposal requested and PDF downloaded.");
    } catch { setFeedback(snapshot.current ? "Selection locked. PDF download failed; please retry." : "Your proposal couldn’t be locked. Please try again."); }
    finally { setBusy(false); }
  }
  if (query.isPending) return <p role="status" className="p-12 text-muted-foreground">Preparing your collection…</p>;
  if (query.isError || !query.data) return <div role="alert" className="p-12"><p>Your collection choices couldn’t load.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>;
  const proposalButton = <Button disabled={busy || !slots.length} onClick={() => void requestProposal()}><Lock className="size-4" />{busy ? "Preparing proposal…" : locked ? "Download Locked Proposal" : "Lock & Download Proposal"}</Button>;
  return <div className="viewing-room bg-background text-foreground">
    <ViewingRoomCanvas items={items} environmentUrl={environmentUrl} activeSlotIds={slots.filter(slot => slot.is_swappable || slot.allow_finish_customization).map(slot => slot.id)} onPieceClick={id => { const slot = slots.find(row => row.id === id); if (!slot) return; setActive(id); setInspect(false); setSwatches(true); setDrawerTab(slot.is_swappable ? "alternatives" : "finishes"); }} />
    <div className="flex flex-wrap gap-2 px-6 py-4" aria-label="Collection pieces">{slots.map(slot => <Button key={slot.id} variant="ghost" className="h-auto whitespace-normal text-left text-xs" onClick={() => { setActive(slot.id); setInspect(false); setSwatches(true); setDrawerTab(slot.is_swappable ? "alternatives" : "finishes"); }}>{(choices[slot.id] ?? slot).product_name}</Button>)}</div>
    <div className="sticky bottom-0 z-40 flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background px-6 py-5" data-visualiser-hotspot-obstacle>
      <div><p className="text-xs text-muted-foreground">Package Total</p><p className="font-display text-2xl" aria-live="polite">{money(total)}</p></div>{proposalButton}
      {feedback && <p role="status" className="w-full text-sm">{feedback}</p>}
    </div>
    <Sheet open={!!piece} onOpenChange={open => { if (!open) setActive(null); }}>
      <SheetContent className="viewing-room flex w-full flex-col overflow-y-auto bg-background text-foreground sm:max-w-lg" side="right">
        <SheetTitle className="pr-8 font-display text-2xl">{piece?.product_name}</SheetTitle><SheetDescription>{piece?.dimensions ?? "Dimensions to be confirmed"}</SheetDescription>
        {piece && <>
          <Tabs value={drawerTab} onValueChange={setDrawerTab} className="min-w-0"><TabsList className="grid h-auto w-full grid-cols-2 bg-transparent p-0"><TabsTrigger value="alternatives" className="whitespace-normal text-xs">Curated Alternatives</TabsTrigger><TabsTrigger value="finishes" className="whitespace-normal text-xs">3D Finish Customizer</TabsTrigger></TabsList>
          <TabsContent value="finishes" className="space-y-4 pt-4">
          {inspect && piece.glb_url ? <Product3DViewer key={piece.id} url={piece.glb_url} alt={piece.product_name} poster={piece.image_url} autoOpen materialRoles={materialRoles} onMaterialsDiscovered={discoverMaterials} baseTextureUrl={swatches ? piece.materials.base?.image_url : null} topTextureUrl={swatches ? piece.materials.top?.image_url : null} fabricTextureUrl={swatches ? piece.materials.upholstery?.image_url : null} /> : piece.image_url && <img src={piece.image_url} alt={piece.product_name} className="aspect-[4/3] w-full object-contain" />}
          <Button variant="outline" disabled={!piece.glb_url} onClick={() => setInspect(value => !value)}><Box className="size-4" />{inspect ? "Close 3D Inspect" : "3D Inspect"}</Button>
          {!current?.allow_finish_customization && <p className="text-sm text-muted-foreground">The finishes for this piece are locked.</p>}
          {Object.keys(piece.materials).length > 0 ? <div className="space-y-3">{current?.allow_finish_customization && <label className="flex items-center gap-2 text-sm"><Checkbox checked={swatches} disabled={locked || busy} onCheckedChange={checked => setSwatches(checked === true)} />Apply selected swatches</label>}<div className="flex flex-wrap gap-3">{Object.values(piece.materials).map(material => <figure key={material.id} className="max-w-28">{material.image_url && <img src={material.image_url} alt={material.name} className="size-12 rounded-full object-cover" />}<figcaption className="mt-2 text-xs">{material.name}</figcaption></figure>)}</div></div> : <p className="text-xs text-muted-foreground">No linked material swatches.</p>}
          </TabsContent><TabsContent value="alternatives" className="space-y-4 pt-4">
          {piece.image_url && <img src={piece.image_url} alt={piece.product_name} className="aspect-[4/3] w-full object-contain" />}
          {!query.data.allow_alternatives || !current?.is_swappable ? <p className="text-sm text-muted-foreground">This furniture selection is fixed. Swaps are not available.</p> : !current?.alternatives.length && <p className="text-sm text-muted-foreground">No approved alternatives linked to this slot yet.</p>}
          {current?.alternatives.map(option => <article key={option.id} className="flex items-center gap-4 border-b border-border py-4">{option.image_url && <img src={option.image_url} alt={option.product_name} className="size-20 object-contain" />}<div className="min-w-0 flex-1"><p className="font-display">{option.product_name}</p><p className="my-2 text-xs">{option.retail_price == null ? "Price to be confirmed" : `${option.retail_price_from ? "From " : ""}${money(option.retail_price)}`}</p><Button variant="outline" disabled={locked || busy || current.retail_price == null || option.retail_price == null || piece.id === option.id} onClick={() => { const updated = { ...choices, [current.id]: option }; setChoices(updated); onTotal(viewingRoomTotal(baseTotal, slots, updated)); setInspect(false); }}>{piece.id === option.id ? "Selected" : "Swap piece"}</Button></div></article>)}
          {current && choices[current.id] && <Button variant="ghost" disabled={locked || busy} onClick={() => { const updated = { ...choices }; delete updated[current.id]; setChoices(updated); onTotal(viewingRoomTotal(baseTotal, slots, updated)); }}>Restore original piece</Button>}
          </TabsContent></Tabs>
        </>}
        <div className="sticky bottom-0 mt-auto border-t border-border bg-background py-4"><p className="mb-3 font-display text-lg">Package Total · {money(total)}</p>{proposalButton}{feedback && <p role="status" className="mt-3 text-xs">{feedback}</p>}</div>
      </SheetContent>
    </Sheet>
  </div>;
}