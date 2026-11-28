import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { prepareAiRenderImages } from "@/lib/aiRenderImages";
import { planPoint, type ProposalProduct } from "@/lib/proposalRenderDraft";
import { fullFrameCorrectionImage, furnitureCorrectionRequest, type CorrectionArea } from "@/lib/furnitureCorrection";
import { uploadPrivateTradeAsset } from "@/lib/privateTradeUpload";
import { useAuth } from "@/hooks/useAuth";
import BeforeAfterSplit from "./BeforeAfterSplit";

export default function FurnitureCorrectionDialog({ imageUrl, products, onClose, onApply }: { imageUrl: string; products: ProposalProduct[]; onClose: () => void; onApply: (url: string) => void }) {
  const { user } = useAuth();
  const [pieceId, setPieceId] = useState(products[0]?.id ?? "");
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
      const { data, error: failure } = await supabase.functions.invoke("axonometric-generate", { body: await prepareAiRenderImages({ ...furnitureCorrectionRequest(imageUrl, piece, area, products), qualityTier: "standard" }) });
      if (failure || data?.error) throw new Error(data?.error || failure?.message || "Correction failed.");
      const editedUrl = data?.storedUrl || data?.imageUrl;
      if (!editedUrl) throw new Error("No corrected image returned.");
      const blob = await fullFrameCorrectionImage(editedUrl);
      const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      const url = await uploadPrivateTradeAsset(`axonometric-sources/${user.id}/correction-${crypto.randomUUID()}.${extension}`, blob, blob.type);
      setCandidate(url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The piece could not be corrected. Your current render is unchanged."); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto" onInteractOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader><DialogTitle>Correct one furniture piece</DialogTitle></DialogHeader>
    <div className="space-y-2"><Label htmlFor="correction-product">Intended furniture</Label><Select value={pieceId} disabled={busy} onValueChange={id => { setPieceId(id); setCandidate(null); }}><SelectTrigger id="correction-product"><SelectValue /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}</SelectContent></Select></div>
    {candidate ? <BeforeAfterSplit beforeUrl={imageUrl} afterUrl={candidate} beforeLabel="Current render" afterLabel="Corrected piece" /> : <div className="space-y-2"><Label>Correction area</Label><div className="relative overflow-hidden border border-border rounded-md"><img src={imageUrl} alt="Current room render" className="block w-full" draggable={false} /><svg role="group" aria-label="Draw correction area" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full touch-none text-primary"
      onPointerDown={event => { if (busy) return; start.current = planPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()); setCandidate(null); setArea(null); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (busy || !start.current) return; const point = planPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()); setArea({ x: Math.min(start.current.x, point.x), y: Math.min(start.current.y, point.y), width: Math.abs(point.x - start.current.x), height: Math.abs(point.y - start.current.y) }); }}
      onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }}>
      {area && <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 1" />}
    </svg></div></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={onClose}><X className="size-4" />Cancel</Button>{candidate && <Button variant="outline" onClick={() => setCandidate(null)}>Adjust area</Button>}<Button variant="outline" disabled={busy || !piece || !area || area.width < 1 || area.height < 1} onClick={generate}>{busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{busy ? "Correcting piece…" : candidate ? "Retry correction" : "Regenerate piece"}</Button>{candidate && <Button onClick={() => onApply(candidate)}><Check className="size-4" />Apply correction</Button>}</div>
  </DialogContent></Dialog>;
}