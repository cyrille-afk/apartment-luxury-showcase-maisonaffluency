import { useState, useCallback, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Pencil, Box, Loader2 } from "lucide-react";
import SectionHero from "@/components/trade/SectionHero";
import PlanUploader from "@/components/room-planner/PlanUploader";
import WallTracer from "@/components/room-planner/WallTracer";
import ProductPalette from "@/components/room-planner/ProductPalette";
import type { Room, PlacedProduct } from "@/components/room-planner/types";
import type { TradeProduct } from "@/lib/tradeProducts";
import { cn } from "@/lib/utils";

const RoomScene3D = lazy(() => import("@/components/room-planner/RoomScene3D"));

type Step = "upload" | "trace" | "view3d";

const TradeRoomPlanner = () => {
  const [step, setStep] = useState<Step>("upload");
  const [planImageUrl, setPlanImageUrl] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<TradeProduct | null>(null);
  const [pixelsPerMeter, setPixelsPerMeter] = useState(50);

  const handlePlanUploaded = useCallback((url: string) => {
    setPlanImageUrl(url);
    setStep("trace");
  }, []);

  const handleTraceDone = useCallback(() => {
    setStep("view3d");
  }, []);

  const handleFloorClick = useCallback(
    (position: { x: number; y: number; z: number }) => {
      if (!selectedProduct) return;
      const newPlaced: PlacedProduct = {
        id: `placed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: selectedProduct.id,
        productName: selectedProduct.product_name,
        brandName: selectedProduct.brand_name,
        imageUrl: selectedProduct.image_url,
        position,
        rotation: 0,
        scale: 1,
      };
      setPlacedProducts((prev) => [...prev, newPlaced]);
    },
    [selectedProduct],
  );

  const handleRemoveProduct = useCallback((productId: string) => {
    setPlacedProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  return (
    <>
      <Helmet>
        <title>Room Planner — Trade Portal — Maison Affluency</title>
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="shrink-0">
          <SectionHero
            section="room-planner"
            title="3D Room Planner"
            subtitle={
              step === "upload"
                ? "Upload an architectural floor plan to get started"
                : step === "trace"
                  ? "Trace your room walls by clicking corners on the plan"
                  : "Explore your space in 3D and furnish it with products"
            }
          >
            {step !== "upload" && (
              <button
                onClick={() => setStep(step === "view3d" ? "trace" : "upload")}
                className="flex items-center gap-1.5 p-2 border border-background/30 rounded-md text-background/70 hover:text-background hover:border-background/50 transition-colors"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
          </SectionHero>

          {/* Step indicator */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/20">
            {(["upload", "trace", "view3d"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <div className="w-8 h-px bg-border" />}
                <button
                  onClick={() => {
                    if (s === "upload") setStep("upload");
                    else if (s === "trace" && planImageUrl) setStep("trace");
                    else if (s === "view3d" && rooms.length > 0) setStep("view3d");
                  }}
                  disabled={
                    (s === "trace" && !planImageUrl) || (s === "view3d" && rooms.length === 0)
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-[0.1em] transition-colors",
                    step === s
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground disabled:opacity-30"
                  )}
                >
                  {s === "upload" && "1. Upload"}
                  {s === "trace" && "2. Trace"}
                  {s === "view3d" && "3. 3D View"}
                </button>
              </div>
            ))}

            {step === "view3d" && (
              <>
                <div className="flex-1" />
                <label className="flex items-center gap-2 font-body text-xs text-muted-foreground">
                  Scale (px/m):
                  <input
                    type="number"
                    value={pixelsPerMeter}
                    onChange={(e) => setPixelsPerMeter(Math.max(10, parseInt(e.target.value) || 50))}
                    className="w-16 px-2 py-1 rounded border border-border bg-background text-foreground text-xs"
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex">
          {step === "upload" && (
            <div className="flex-1 overflow-auto">
              <PlanUploader onPlanUploaded={handlePlanUploaded} />
            </div>
          )}

          {step === "trace" && planImageUrl && (
            <div className="flex-1">
              <WallTracer
                planImageUrl={planImageUrl}
                rooms={rooms}
                onRoomsChange={setRooms}
                onDone={handleTraceDone}
              />
            </div>
          )}

          {step === "view3d" && (
            <>
              <div className="flex-1 min-w-0">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                    </div>
                  }
                >
                  <RoomScene3D
                    rooms={rooms}
                    placedProducts={placedProducts}
                    wallHeight={2.8}
                    pixelsPerMeter={pixelsPerMeter}
                    planImageUrl={planImageUrl!}
                    onProductClick={handleRemoveProduct}
                    onFloorClick={handleFloorClick}
                  />
                </Suspense>
              </div>
              <div className="w-72 shrink-0">
                <ProductPalette
                  onProductSelect={setSelectedProduct}
                  selectedProductId={selectedProduct?.id || null}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default TradeRoomPlanner;
