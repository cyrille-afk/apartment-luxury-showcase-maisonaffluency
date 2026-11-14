import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { StudioFinish } from "@/lib/studioFinishes";

export function StudioFinishMagnifier({ finish, onClose }: { finish: StudioFinish | null; onClose: () => void }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageUrl = finish?.image_url || undefined;
  return <Dialog open={finish !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl gap-3 p-4 sm:p-6" onClick={e => e.stopPropagation()}>
      <DialogTitle className="pl-9 pr-8 font-display text-xl sm:pl-0">{finish?.name}</DialogTitle>
      <DialogDescription>{finish?.category}{finish?.brand_name ? ` · ${finish.brand_name}` : ""}</DialogDescription>
      {imageUrl && failedImage !== imageUrl ? <TransformWrapper key={imageUrl} minScale={1} maxScale={6} centerOnInit wheel={{ step: 0.08 }} doubleClick={{ mode: "toggle", step: 1 }}>
        {({ zoomIn, zoomOut, resetTransform }) => <>
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label="Magnify finish" title="Zoom in" className="cursor-pointer" onClick={() => zoomIn()}><ZoomIn className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Reduce finish magnification" title="Zoom out" className="cursor-pointer" onClick={() => zoomOut()}><ZoomOut className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Fit finish image" title="Fit image" className="cursor-pointer" onClick={() => resetTransform()}><Scan className="size-4" /></Button>
          </div>
          <div className="flex h-[min(55dvh,32rem)] min-h-0 items-center justify-center overflow-hidden bg-muted">
            <TransformComponent wrapperClass="!h-full !w-full touch-none" contentClass="!h-full !w-full">
              <img src={imageUrl} alt={`${finish?.name} finish sample`} draggable={false} onError={() => setFailedImage(imageUrl)} className="h-full w-full cursor-grab object-contain active:cursor-grabbing" />
            </TransformComponent>
          </div>
        </>}
      </TransformWrapper> : <p role="status" className="py-12 text-center text-sm text-muted-foreground">This finish image is unavailable.</p>}
    </DialogContent>
  </Dialog>;
}