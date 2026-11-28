import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Check, X, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { prepareAiRenderImages } from "@/lib/aiRenderImages";
import { planPoint, type ProposalProduct } from "@/lib/proposalRenderDraft";
import { fullFrameCorrectionImage, furnitureCorrectionRequest, furnitureRemovalRequest, type CorrectionArea } from "@/lib/furnitureCorrection";
import { uploadPrivateTradeAsset } from "@/lib/privateTradeUpload";
import { useAuth } from "@/hooks/useAuth";
import BeforeAfterSplit from "./BeforeAfterSplit";

export default function FurnitureCorrectionDialog({ imageUrl, products, removal = false, initialPieceId, onClose, onApply }: { imageUrl: string; products: ProposalProduct[]; removal?: boolean; initialPieceId?: string; onClose: () => void; onApply: (url: string, pieceId?: string) => void }) {
  const { user } = useAuth();
  const [pieceId, setPieceId] = useState(initialPieceId ?? products[0]?.id ?? "");
  const [area, setArea] = useState<CorrectionArea | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const piece = products.find(p => p.id === pieceId);
  const generate = async () => {
    if (!piece || !area || !user || busy) return;
    setBusy(true); setError(null); setCandidate(null);
    try {
      const request = removal ? furnitureRemovalRequest(imageUrl, piece, area, products) : furnitureCorrectionRequest(imageUrl, piece, area, products);
      const { data, error: failure } = await supabase.functions.invoke("axonometric-generate", { body: await prepareAiRenderImages({ ...request, qualityTier: "standard" }) });
      if (failure || data?.error) throw new Error(data?.error || failure?.message || "Correction failed.");
      const editedUrl = data?.storedUrl || data?.imageUrl;
      if (!editedUrl) throw new Error("No corrected image returned.");
      const blob = await fullFrameCorrectionImage(editedUrl);
      const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      const url = await uploadPrivateTradeAsset(`axonometric-sources/${user.id}/correction-${crypto.randomUUID()}.${extension}`, blob, blob.type);
      setCandidate(url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The piece could not be edited. Your current render and selections are unchanged."); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto" onInteractOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader className="pl-8 sm:pl-0"><DialogTitle>{removal ? "Remove one furniture piece" : "Correct one furniture piece"}</DialogTitle></DialogHeader>
    {removal && <p className="text-sm text-muted-foreground">Review the edited image first. Applying removal deletes this instance from the selection too; other identical pieces stay.</p>}
    <div className="space-y-2"><Label htmlFor="correction-product">{removal ? "Furniture to remove" : "Intended furniture"}</Label><Select value={pieceId} disabled={busy || Boolean(initialPieceId)} onValueChange={id => { setPieceId(id); setCandidate(null); setArea(null); }}><SelectTrigger id="correction-product"><SelectValue /></SelectTrigger><SelectContent>{products.map((p, i) => <SelectItem key={p.id} value={p.id}>{removal ? `${i + 1}. ` : ""}{p.product_name}</SelectItem>)}</SelectContent></Select></div>
    {candidate ? <div className="relative aspect-square max-h-[60dvh] w-full overflow-hidden rounded-md border border-border"><BeforeAfterSplit beforeUrl={imageUrl} afterUrl={candidate} beforeLabel="Current render" afterLabel={removal ? "Piece removed" : "Corrected piece"} /></div> : <div className="space-y-2"><Label>{removal ? "Piece to remove" : "Correction area"}</Label><div className="relative overflow-hidden border border-border rounded-md"><img src={imageUrl} alt="Current room render" className="block w-full" draggable={false} /><svg role="group" aria-label="Draw correction area" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full touch-none text-primary"
      onPointerDown={event => { if (busy) return; start.current = planPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()); setCandidate(null); setArea(null); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (busy || !start.current) return; const point = planPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()); setArea({ x: Math.min(start.current.x, point.x), y: Math.min(start.current.y, point.y), width: Math.abs(point.x - start.current.x), height: Math.abs(point.y - start.current.y) }); }}
      onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }}>
      {area && <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 1" />}
    </svg>
    {busy ? null : area
      ? <p className="pointer-events-none absolute left-2 top-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">{removal ? "Box drawn — press “Generate removal”." : "Box drawn — press “Regenerate piece”."}</p>
      : <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center"><p className="max-w-md rounded-md bg-background/90 px-3 py-2 text-center text-sm font-medium text-foreground shadow-sm">{removal ? "Drag a box over the one piece you want to remove." : "Drag a box over the incorrect piece — here, the wrong chair — before you can generate a correction."}</p></div>}
    </div></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={onClose}><X className="size-4" />Cancel</Button>{candidate && <Button variant="outline" onClick={() => setCandidate(null)}>Adjust area</Button>}<Button variant="outline" disabled={busy || !piece || !area || area.width < 1 || area.height < 1} onClick={generate}>{busy ? <Loader2 className="size-4 animate-spin" /> : removal ? <Trash2 className="size-4" /> : <RefreshCw className="size-4" />}{busy ? removal ? "Removing piece…" : "Correcting piece…" : removal ? candidate ? "Retry removal" : "Generate removal" : candidate ? "Retry correction" : "Regenerate piece"}</Button>{candidate && <Button disabled={busy} onClick={() => onApply(candidate, removal ? pieceId : undefined)}><Check className="size-4" />{removal ? "Apply removal" : "Apply correction"}</Button>}</div>
  </DialogContent></Dialog>;
}