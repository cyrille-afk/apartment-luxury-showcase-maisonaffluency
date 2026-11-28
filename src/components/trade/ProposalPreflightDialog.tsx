import { useEffect, useState } from "react";
import { ArrowLeft, Camera, Crosshair, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cropRoomPlan, roomCropCamera, validRoomZone, type RoomZone } from "@/lib/roomZone";
import { type EyeLevelCamera, type ProposalProduct } from "@/lib/proposalRenderDraft";
import { EYE_LEVEL_HEIGHT_M, EYE_LEVEL_LENS_MM } from "../../../supabase/functions/_shared/eyeLevelCamera";
import PrivateTradeImage from "./PrivateTradeImage";

type Props = {
  mode: "shell" | "proposal";
  eyeLevel: boolean;
  planUrl: string;
  shellUrl: string | null;
  suppliedShell: boolean;
  zone: RoomZone | null;
  camera: EyeLevelCamera | null;
  products: ProposalProduct[];
  activeProducts: ProposalProduct[];
  quality: string;
  warning: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ProposalPreflightDialog({ mode, eyeLevel, planUrl, shellUrl, suppliedShell, zone, camera, products, activeProducts, quality, warning, onClose, onConfirm }: Props) {
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const needsCrop = eyeLevel && validRoomZone(zone);
  useEffect(() => {
    if (!needsCrop || !zone) return;
    let cancelled = false;
    let url: string | null = null;
    setCropUrl(null); setCropError(null);
    void cropRoomPlan(planUrl, zone).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob); setCropUrl(url);
    }).catch(() => { if (!cancelled) setCropError("The room crop couldn’t load. Retry before generating."); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [planUrl, zone, needsCrop, retry]);
  let previewCamera = camera;
  if (camera && needsCrop && zone) {
    try { previewCamera = roomCropCamera(camera, zone); } catch { previewCamera = null; }
  }
  const activeIds = new Set(activeProducts.map(piece => piece.id));
  const image = needsCrop ? cropUrl : planUrl;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-5xl max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden">
      <DialogHeader className="p-5 pl-14 sm:pl-5 pr-10 border-b border-border text-left">
        <DialogTitle className="font-display">Generation preflight</DialogTitle>
        <DialogDescription>{mode === "shell" ? "Eye-Level Shell" : eyeLevel ? "Eye-Level Furniture Proposal" : "Axonometric Furniture Proposal"} · <span className="capitalize">{quality}</span></DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto min-h-0 p-5 grid gap-6 md:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <h3 className="font-display text-sm">{needsCrop ? zone?.room_name : "Room plan"}</h3>
          <div className="relative border border-border rounded-md overflow-hidden bg-muted/10">
            {image ? <PrivateTradeImage src={image} alt={needsCrop ? "Preflight room crop" : "Preflight room plan"} className="block w-full" /> : <div className="min-h-48 grid place-items-center text-sm text-muted-foreground">{cropError ? "Crop unavailable" : "Preparing room crop…"}</div>}
            {eyeLevel && image && previewCamera && <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full text-primary" role="img" aria-label="Preflight camera position and sightline">
              <defs><marker id="preflight-camera-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="currentColor" /></marker></defs>
              <line x1={previewCamera.position.x} y1={previewCamera.position.y} x2={previewCamera.target.x} y2={previewCamera.target.y} stroke="currentColor" strokeWidth="0.7" markerEnd="url(#preflight-camera-arrow)" />
              <circle cx={previewCamera.position.x} cy={previewCamera.position.y} r="2" fill="currentColor" stroke="var(--background)" strokeWidth="0.5" />
              <circle cx={previewCamera.target.x} cy={previewCamera.target.y} r="1.5" fill="currentColor" stroke="var(--background)" strokeWidth="0.5" />
            </svg>}
          </div>
          {cropError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{cropError}</p><Button size="sm" variant="outline" onClick={() => setRetry(previous => previous + 1)}><RefreshCw />Retry crop</Button></div>}
          {needsCrop && zone && <p className="text-xs text-muted-foreground">Crop: {Math.round(zone.x)}%, {Math.round(zone.y)}% · {Math.round(zone.width)}% × {Math.round(zone.height)}% of plan</p>}
          {eyeLevel && <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-2"><Camera className="size-4 shrink-0" />{suppliedShell && mode === "proposal" ? "Uploaded / captured room perspective retained" : `${EYE_LEVEL_HEIGHT_M} m · ${EYE_LEVEL_LENS_MM} mm`}</p>
            <p className="flex items-start gap-2"><Crosshair className="size-4 shrink-0" />{previewCamera ? `Camera: ${Math.round(previewCamera.position.x)}%, ${Math.round(previewCamera.position.y)}% → Sightline: ${Math.round(previewCamera.target.x)}%, ${Math.round(previewCamera.target.y)}%${needsCrop ? " within crop" : ""}` : "Camera not placed"}</p>
          </div>}
          {mode === "proposal" && shellUrl && <div className="space-y-2"><h3 className="font-display text-sm">{eyeLevel ? "Staging room" : "Empty room"}</h3><PrivateTradeImage src={shellUrl} alt="Preflight staging room" className="block w-full rounded-md border border-border" /></div>}
        </section>
        <section className="min-w-0 space-y-3">
          <h3 className="font-display text-sm">Selected items ({products.length}) · {activeProducts.length} in this room</h3>
          {mode === "shell" && <p className="text-xs text-muted-foreground">This generation creates the empty room only. Furniture is staged in the proposal.</p>}
          <ul className="divide-y divide-border">
            {products.map((piece, index) => {
              const included = activeIds.has(piece.id);
              return <li key={piece.id} className="flex gap-3 py-3 min-w-0">
                <PrivateTradeImage src={piece.image_url} alt={piece.product_name} className="size-16 shrink-0 object-contain border border-border rounded-md bg-muted/10" />
                <div className="min-w-0 space-y-1 text-xs">
                  <p className="font-medium text-sm break-words">{index + 1}. {piece.product_name}</p>
                  <p className="text-muted-foreground break-words">{piece.brand_name}</p>
                  <p className={included ? "text-foreground" : "text-muted-foreground"}>{included ? "Included in this room" : `Excluded · ${piece.room_section || "Other room"}`}</p>
                  {piece.dimensions && <p className="break-words text-muted-foreground">{piece.dimensions}</p>}
                  {(piece.selected_finishes?.length ? piece.selected_finishes.map(finish => `${finish.axis}: ${finish.name}`).join(" · ") : piece.material_override || piece.materials) && <p className="break-words text-muted-foreground">{piece.selected_finishes?.length ? piece.selected_finishes.map(finish => `${finish.axis}: ${finish.name}`).join(" · ") : piece.material_override || piece.materials}</p>}
                  {eyeLevel && included && mode === "proposal" && <p className="text-muted-foreground">{piece.target ? `Placement: ${Math.round(piece.target.x)}%, ${Math.round(piece.target.y)}%${piece.target.instruction ? ` · ${piece.target.instruction}` : ""}` : "Placement pin missing"}</p>}
                </div>
              </li>;
            })}
          </ul>
          {!products.length && <p className="text-sm text-muted-foreground">No furniture selected.</p>}
        </section>
      </div>
      <div className="border-t border-border p-4 space-y-3">
        {warning && <p role="alert" className="text-sm text-destructive">{warning}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}><ArrowLeft />Back to editing</Button>
          <Button disabled={Boolean(warning || (needsCrop && !cropUrl))} onClick={onConfirm}><Wand2 />{mode === "shell" ? "Generate Eye-Level Shell" : `Generate Proposal (${activeProducts.length})`}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}