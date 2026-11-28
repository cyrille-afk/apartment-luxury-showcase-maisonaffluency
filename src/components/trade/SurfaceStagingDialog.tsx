import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { prepareAiRenderImages } from "@/lib/aiRenderImages";
import type { ProposalProduct } from "@/lib/proposalRenderDraft";
import type { EyeLevelCatalogueProduct } from "@/hooks/useEyeLevelCatalogue";
import { isEyeLevelSurface, surfaceEditPrompt, surfaceMetricSize } from "../../../supabase/functions/_shared/eyeLevelSurfaces";
import EyeLevelPlacementShell from "./EyeLevelPlacementShell";
import BeforeAfterSplit from "./BeforeAfterSplit";

export default function SurfaceStagingDialog({ imageUrl, products, catalogue, onClose, onApply }: {
  imageUrl: string; products: ProposalProduct[]; catalogue: EyeLevelCatalogueProduct[];
  onClose: () => void; onApply: (url: string, piece: ProposalProduct) => void;
}) {
  const [role, setRole] = useState("rug");
  const [search, setSearch] = useState("");
  const [piece, setPiece] = useState<ProposalProduct | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = useMemo(() => catalogue.filter(p => p.category_role === role && p.image_url &&
    `${p.product_name} ${p.brand_name}`.toLowerCase().includes(search.toLowerCase())), [catalogue, role, search]);
  let warning = "Select a piece.";
  if (piece) { try { surfaceEditPrompt(piece); warning = ""; } catch (e) { warning = e instanceof Error ? e.message : "Check this piece."; } }
  const generate = async () => {
    if (!piece || warning || pending) return;
    setPending(true); setError(null);
    try {
      const existing = products.filter(p => p.id !== piece.id);
      if (existing.length >= 10) throw new Error("Maximum 10 products per proposal.");
      const { data, error: requestError } = await supabase.functions.invoke("axonometric-generate", { body: await prepareAiRenderImages({
        mode: "proposal_refine", imageUrl, referenceImageUrl: null, surfaceStagingId: piece.id,
        placements: [piece, ...existing], refinementPrompt: surfaceEditPrompt(piece),
      }) });
      if (requestError || data?.error) throw new Error(data?.error || requestError?.message || "Staging failed.");
      const url = data?.storedUrl || data?.imageUrl;
      if (!url) throw new Error("No room view returned.");
      setResult(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Staging failed. Your current room remains unchanged."); }
    finally { setPending(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent className="w-[96vw] max-w-6xl max-h-[92dvh] overflow-y-auto"><DialogHeader><DialogTitle>Stage rug or wall artwork</DialogTitle></DialogHeader>
    {result && piece ? <><div className="h-[55dvh] min-h-64"><BeforeAfterSplit beforeUrl={imageUrl} afterUrl={result} beforeLabel="Current room" afterLabel="Proposed room" /></div><div className="flex flex-wrap gap-2"><Button onClick={() => onApply(result, piece)}>Apply to room</Button><Button variant="outline" onClick={() => { setResult(null); }}> <Undo2 />Adjust</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div></> : <>
      <div className="flex flex-wrap gap-2"><Select value={role} disabled={pending} onValueChange={value => { setRole(value); setPiece(null); setError(null); }}><SelectTrigger className="w-44" aria-label="Surface category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rug">Rugs</SelectItem><SelectItem value="artwork">Wall artworks</SelectItem></SelectContent></Select><Input aria-label="Search rugs and artworks" placeholder="Search catalogue" value={search} disabled={pending} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-40" /></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_2fr]"><div className="grid grid-cols-2 gap-2 max-h-[55dvh] overflow-y-auto content-start">{candidates.map(p => <Button key={p.id} variant={piece?.product_id === p.trade_product_id ? "default" : "outline"} disabled={pending} className="h-auto flex-col items-start whitespace-normal p-2 text-left" onClick={() => {
        const existing = products.find(item => item.product_id === (p.trade_product_id ?? p.id) && isEyeLevelSurface(item));
        setPiece(existing ?? { id: crypto.randomUUID(), product_id: p.trade_product_id ?? p.id, product_name: p.product_name, brand_name: p.brand_name, image_url: p.image_url ?? "", ...(p.category_role ? { category_role: p.category_role } : {}),
          width_m: p.width_m, depth_m: p.depth_m, height_m: p.height_m, ...(p.materials ? { materials: p.materials } : {}) }); setError(null);
      }}><img src={p.image_url ?? ""} alt={p.product_name} className="w-full aspect-square object-contain bg-background" /><span className="text-xs">{p.product_name}</span><span className="text-xs opacity-70">{p.brand_name}</span></Button>)}{!candidates.length && <p className="col-span-2 text-sm text-muted-foreground">No matching catalogue pieces.</p>}</div>
        <div>{piece ? <><p className="mb-2 text-sm">{piece.product_name} · {(() => { try { return surfaceMetricSize(piece); } catch { return "Dimensions unconfirmed"; } })()}</p><div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs">Width (m)<Input aria-label="Surface width in metres" type="number" min="0.01" step="0.01" disabled={pending} value={piece.width_m ?? ""} onChange={e => setPiece({ ...piece, width_m: Number(e.target.value) })} /></label><label className="text-xs">{role === "artwork" ? "Height (m)" : "Depth (m)"}<Input aria-label={role === "artwork" ? "Artwork height in metres" : "Rug depth in metres"} type="number" min="0.01" step="0.01" disabled={pending} value={(role === "artwork" ? piece.height_m : piece.depth_m) ?? ""} onChange={e => setPiece({ ...piece, [role === "artwork" ? "height_m" : "depth_m"]: Number(e.target.value) })} /></label></div>{role === "artwork" ? <EyeLevelPlacementShell url={imageUrl} products={[piece]} disabled={pending} onTarget={(_id, target) => { const { target: old, ...rest } = piece; setPiece(target ? { ...rest, target } : rest); }} /> : <img src={imageUrl} alt="Current locked room" className="w-full object-contain" />}</> : <img src={imageUrl} alt="Current locked room" className="w-full object-contain" />}</div></div>
      <p role={error ? "alert" : undefined} className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{error || warning}</p><div className="flex gap-2"><Button disabled={pending || Boolean(warning)} onClick={() => void generate()}><Wand2 />{pending ? "Staging…" : "Stage in room"}</Button><Button variant="ghost" disabled={pending} onClick={onClose}>Cancel</Button></div>
    </>}
  </DialogContent></Dialog>;
}