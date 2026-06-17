import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Stage, Layer, Image as KImage, Rect, Group, Text as KText, Line, Circle } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Ruler, Download, Trash2, RotateCw, Copy, Save, Search, Crosshair } from "lucide-react";
import { parseDimensionsCm } from "@/lib/floorplan/parseDimensions";
import { exportFloorPlanPdf } from "@/lib/floorplan/exportPdf";

type Pt = { x: number; y: number };

interface PlacedItem {
  id: string;
  productId: string;
  label: string;
  brand: string;
  dimensionsText: string;
  x_cm: number;
  y_cm: number;
  w_cm: number;
  d_cm: number;
  rotation: number; // degrees
}

const NEW_ID = () => `i_${Math.random().toString(36).slice(2, 9)}`;

function PlanImage({ src }: { src: string }) {
  const [img] = useImage(src, "anonymous");
  if (!img) return null;
  return <KImage image={img} listening={false} />;
}

export default function TradeFloorPlan() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { products } = useTradeProducts();

  // ---------- Admin gate + audit log ----------
  useEffect(() => {
    if (!isAdmin) {
      supabase
        .rpc("log_unauthorized_access", {
          _route: "/trade/floor-plan",
          _details: {
            timestamp: new Date().toISOString(),
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            referrer: typeof document !== "undefined" ? document.referrer || null : null,
          },
        })
        .then(({ error }) => {
          if (error) console.warn("[floor-plan] audit log failed", error);
        });
      const id = setTimeout(() => navigate("/trade", { replace: true }), 2500);
      return () => clearTimeout(id);
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <Helmet><title>Admin Only — Maison Affluency</title></Helmet>
        <h1 className="font-heading text-2xl text-foreground mb-3">Admin Only</h1>
        <p className="font-body text-sm text-muted-foreground max-w-md">
          The Floor Plan Layout tool is restricted to admin users. You will be redirected to the Trade lounge shortly.
        </p>
      </div>
    );
  }

  // ---------- State ----------
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [planNaturalSize, setPlanNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [pxPerCm, setPxPerCm] = useState<number | null>(null);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDimensions, setShowDimensions] = useState(true);
  const [query, setQuery] = useState("");
  const [layoutName, setLayoutName] = useState("Untitled layout");
  const [savedLayoutId, setSavedLayoutId] = useState<string | null>(null);

  // Calibration
  const [calibrating, setCalibrating] = useState(false);
  const [calibPoints, setCalibPoints] = useState<Pt[]>([]);
  const [calibDialogOpen, setCalibDialogOpen] = useState(false);
  const [calibDistanceCm, setCalibDistanceCm] = useState("");

  const stageRef = useRef<Konva.Stage | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---------- Plan upload ----------
  const onPlanFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPlanUrl(url);
    setPxPerCm(null);
    setItems([]);
    const img = new window.Image();
    img.onload = () => setPlanNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, []);

  // ---------- Stage sizing ----------
  const stageMaxW = 900;
  const stageMaxH = 620;
  const stageScale = useMemo(() => {
    if (!planNaturalSize) return 1;
    return Math.min(stageMaxW / planNaturalSize.w, stageMaxH / planNaturalSize.h, 1);
  }, [planNaturalSize]);
  const stageW = planNaturalSize ? planNaturalSize.w * stageScale : stageMaxW;
  const stageH = planNaturalSize ? planNaturalSize.h * stageScale : stageMaxH;

  // ---------- Calibration handlers ----------
  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!calibrating || !planNaturalSize) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    // Convert from on-screen px to natural image px
    const natural = { x: pos.x / stageScale, y: pos.y / stageScale };
    const next = [...calibPoints, natural];
    setCalibPoints(next);
    if (next.length === 2) {
      setCalibrating(false);
      setCalibDialogOpen(true);
    }
  };

  const finishCalibration = () => {
    const cm = parseFloat(calibDistanceCm);
    if (!cm || cm <= 0 || calibPoints.length !== 2) {
      toast({ title: "Enter a valid distance", variant: "destructive" });
      return;
    }
    const dx = calibPoints[1].x - calibPoints[0].x;
    const dy = calibPoints[1].y - calibPoints[0].y;
    const px = Math.sqrt(dx * dx + dy * dy);
    setPxPerCm(px / cm);
    setCalibDialogOpen(false);
    setCalibPoints([]);
    setCalibDistanceCm("");
    toast({ title: "Scale set", description: `${(px / cm).toFixed(2)} px / cm` });
  };

  // ---------- Catalog (sidebar) ----------
  type CatalogEntry = {
    id: string;
    name: string;
    brand: string;
    image: string | null;
    dimensionsText: string;
    w_cm: number;
    d_cm: number;
  };

  const catalog: CatalogEntry[] = useMemo(() => {
    return (products || [])
      .map((p: any) => {
        const dims = parseDimensionsCm(p.dimensions);
        return {
          id: String(p.id),
          name: p.product_name || p.title || "Untitled",
          brand: p.brand_name || p.designer_name || "",
          image: p.image_url || null,
          dimensionsText: p.dimensions || `${dims.width_cm} × ${dims.depth_cm} cm`,
          w_cm: dims.width_cm,
          d_cm: dims.depth_cm,
        };
      })
      .filter((c) => c.w_cm > 0 && c.d_cm > 0);
  }, [products]);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 200);
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q))
      .slice(0, 200);
  }, [catalog, query]);

  // ---------- Drag from sidebar onto stage ----------
  const dragRef = useRef<CatalogEntry | null>(null);
  const onCatalogDragStart = (e: React.DragEvent, entry: CatalogEntry) => {
    dragRef.current = entry;
    e.dataTransfer.setData("text/plain", entry.id);
    e.dataTransfer.effectAllowed = "copy";
  };
  const onStageContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const entry = dragRef.current;
    dragRef.current = null;
    if (!entry || !pxPerCm) {
      if (!pxPerCm) toast({ title: "Set the scale first", description: "Click 'Calibrate scale' and mark a known distance.", variant: "destructive" });
      return;
    }
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const onScreenX = e.clientX - rect.left;
    const onScreenY = e.clientY - rect.top;
    const naturalX = onScreenX / stageScale;
    const naturalY = onScreenY / stageScale;
    setItems((arr) => [
      ...arr,
      {
        id: NEW_ID(),
        productId: entry.id,
        label: entry.name,
        brand: entry.brand,
        dimensionsText: entry.dimensionsText,
        x_cm: naturalX / pxPerCm - entry.w_cm / 2,
        y_cm: naturalY / pxPerCm - entry.d_cm / 2,
        w_cm: entry.w_cm,
        d_cm: entry.d_cm,
        rotation: 0,
      },
    ]);
  };

  // ---------- Selection / keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        setItems((arr) => arr.filter((i) => i.id !== selectedId));
        setSelectedId(null);
      } else if (e.key.toLowerCase() === "r") {
        setItems((arr) => arr.map((i) => (i.id === selectedId ? { ...i, rotation: (i.rotation + 15) % 360 } : i)));
      } else if (e.key.toLowerCase() === "d") {
        setItems((arr) => {
          const orig = arr.find((i) => i.id === selectedId);
          if (!orig) return arr;
          return [...arr, { ...orig, id: NEW_ID(), x_cm: orig.x_cm + 20, y_cm: orig.y_cm + 20 }];
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const selectedItem = items.find((i) => i.id === selectedId) || null;

  // ---------- Save / Load ----------
  const saveLayout = async () => {
    if (!planUrl) { toast({ title: "Upload a floor plan first", variant: "destructive" }); return; }
    const payload = {
      name: layoutName,
      layout: {
        plan_url: planUrl.startsWith("blob:") ? null : planUrl,
        plan_natural: planNaturalSize,
        px_per_cm: pxPerCm,
        items,
      } as any,
    };
    if (savedLayoutId) {
      const { error } = await supabase.from("trade_floor_plan_layouts").update(payload).eq("id", savedLayoutId);
      if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast({ title: "Not signed in", variant: "destructive" });
      const { data, error } = await supabase
        .from("trade_floor_plan_layouts")
        .insert({ ...payload, user_id: user.id })
        .select("id").single();
      if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
      setSavedLayoutId(data.id);
    }
    toast({ title: "Layout saved" });
  };

  // ---------- Export PDF ----------
  const exporting = useRef(false);
  const onExport = async () => {
    if (exporting.current) return;
    if (!planUrl || !stageRef.current) {
      toast({ title: "Upload a plan first", variant: "destructive" }); return;
    }
    exporting.current = true;
    try {
      // Temporarily deselect for clean export
      const wasSelected = selectedId;
      setSelectedId(null);
      await new Promise((r) => setTimeout(r, 30));
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
      const legend = items.map((it, idx) => ({
        index: idx + 1,
        name: it.label,
        brand: it.brand,
        dimensions: `${Math.round(it.w_cm)} × ${Math.round(it.d_cm)} cm`,
      }));
      const scaleNote = pxPerCm
        ? `Scale calibrated: ${pxPerCm.toFixed(2)} px / cm  ·  ${items.length} items`
        : `Scale not calibrated`;
      const blob = await exportFloorPlanPdf({
        canvasDataUrl: dataUrl,
        canvasWidthPx: stageW,
        canvasHeightPx: stageH,
        title: layoutName,
        legend,
        scaleNote,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${layoutName.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSelectedId(wasSelected);
      toast({ title: "PDF exported" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      exporting.current = false;
    }
  };

  // ---------- Render helpers ----------
  const px = (cm: number) => (pxPerCm ? cm * pxPerCm * stageScale : 0);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Floor Plan Layout — Maison Affluency Trade</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="max-w-[1500px] mx-auto px-4 lg:px-6 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="font-heading text-2xl text-foreground">Floor Plan Layout</h1>
            <p className="font-body text-sm text-muted-foreground">
              Upload a plan, set the scale, drag furniture from the catalog, export as a dimensioned PDF.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="w-56"
              placeholder="Layout name"
            />
            <Button variant="outline" size="sm" onClick={saveLayout}><Save className="w-4 h-4 mr-1" />Save</Button>
            <Button size="sm" onClick={onExport}><Download className="w-4 h-4 mr-1" />Export PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Catalog sidebar */}
          <div className="col-span-12 lg:col-span-3 border rounded-lg bg-card">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search catalog"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{filteredCatalog.length} items · drag onto the plan</p>
            </div>
            <ScrollArea className="h-[560px]">
              <ul className="p-2 space-y-1">
                {filteredCatalog.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => onCatalogDragStart(e, c)}
                    className="flex gap-2 p-2 rounded-md hover:bg-muted cursor-grab active:cursor-grabbing border border-transparent hover:border-border"
                    title={`${c.name} — ${c.dimensionsText}`}
                  >
                    {c.image ? (
                      <img src={c.image} alt={c.name} className="w-12 h-12 object-cover rounded shrink-0 bg-muted" loading="lazy" />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.brand}</p>
                      <p className="text-[10px] text-muted-foreground">{Math.round(c.w_cm)} × {Math.round(c.d_cm)} cm</p>
                    </div>
                  </li>
                ))}
                {filteredCatalog.length === 0 && (
                  <li className="p-6 text-center text-xs text-muted-foreground">No matches</li>
                )}
              </ul>
            </ScrollArea>
          </div>

          {/* Canvas */}
          <div className="col-span-12 lg:col-span-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" />{planUrl ? "Replace plan" : "Upload plan"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPlanFile(f); e.target.value = ""; }}
              />
              <Button
                variant={calibrating ? "default" : "outline"}
                size="sm"
                disabled={!planUrl}
                onClick={() => { setCalibPoints([]); setCalibrating(true); toast({ title: "Calibration", description: "Click two points along a known distance." }); }}
              >
                <Crosshair className="w-4 h-4 mr-1" />
                {calibrating ? `Click point ${calibPoints.length + 1}/2` : pxPerCm ? `Re-calibrate (${pxPerCm.toFixed(2)} px/cm)` : "Calibrate scale"}
              </Button>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} />
                Show dimensions
              </label>
              <div className="ml-auto text-[11px] text-muted-foreground">
                Tip: select an item, press <kbd className="px-1 border rounded">R</kbd> rotate · <kbd className="px-1 border rounded">D</kbd> duplicate · <kbd className="px-1 border rounded">Del</kbd> remove
              </div>
            </div>

            <div
              className="border rounded-lg bg-muted/40 overflow-hidden relative"
              style={{ width: stageW, height: stageH, maxWidth: "100%" }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={onStageContainerDrop}
            >
              {!planUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-foreground">Upload a floor plan to begin</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG / JPG / PDF page export</p>
                </div>
              )}
              {planUrl && (
                <Stage
                  ref={stageRef as any}
                  width={stageW}
                  height={stageH}
                  scale={{ x: stageScale, y: stageScale }}
                  onClick={(e) => {
                    onStageClick(e);
                    if (e.target === e.target.getStage()) setSelectedId(null);
                  }}
                  style={{ cursor: calibrating ? "crosshair" : "default" }}
                >
                  <Layer>
                    <PlanImage src={planUrl} />
                  </Layer>

                  {/* Items */}
                  <Layer>
                    {pxPerCm && items.map((it) => {
                      const isSel = it.id === selectedId;
                      const w = it.w_cm * pxPerCm;
                      const d = it.d_cm * pxPerCm;
                      return (
                        <Group
                          key={it.id}
                          x={it.x_cm * pxPerCm + w / 2}
                          y={it.y_cm * pxPerCm + d / 2}
                          rotation={it.rotation}
                          draggable
                          onClick={(e) => { e.cancelBubble = true; setSelectedId(it.id); }}
                          onTap={(e) => { e.cancelBubble = true; setSelectedId(it.id); }}
                          onDragEnd={(e) => {
                            const cx = e.target.x();
                            const cy = e.target.y();
                            setItems((arr) => arr.map((p) => p.id === it.id
                              ? { ...p, x_cm: (cx - w / 2) / pxPerCm, y_cm: (cy - d / 2) / pxPerCm }
                              : p));
                          }}
                        >
                          <Rect
                            x={-w / 2} y={-d / 2}
                            width={w} height={d}
                            fill={isSel ? "rgba(20,83,45,0.18)" : "rgba(20,83,45,0.10)"}
                            stroke={isSel ? "#14532d" : "#1f2937"}
                            strokeWidth={isSel ? 2 : 1}
                          />
                          {/* small front-edge indicator */}
                          <Line points={[-w / 2, d / 2 - 2, w / 2, d / 2 - 2]} stroke="#14532d" strokeWidth={2} />
                          <KText
                            x={-w / 2 + 4} y={-d / 2 + 4}
                            text={`${items.findIndex((p) => p.id === it.id) + 1}. ${it.label}`}
                            fontSize={Math.min(14, Math.max(9, w / 12))}
                            fill="#0f172a"
                            width={w - 8}
                            ellipsis
                            wrap="none"
                          />
                          {showDimensions && (
                            <KText
                              x={-w / 2 + 4} y={d / 2 - 14}
                              text={`${Math.round(it.w_cm)}×${Math.round(it.d_cm)}`}
                              fontSize={10}
                              fill="#334155"
                            />
                          )}
                        </Group>
                      );
                    })}
                  </Layer>

                  {/* Calibration overlay */}
                  <Layer listening={false}>
                    {calibPoints.map((p, i) => (
                      <Circle key={i} x={p.x} y={p.y} radius={6} fill="#ef4444" />
                    ))}
                    {calibPoints.length === 2 && (
                      <Line points={[calibPoints[0].x, calibPoints[0].y, calibPoints[1].x, calibPoints[1].y]} stroke="#ef4444" strokeWidth={2} dash={[4, 4]} />
                    )}
                  </Layer>
                </Stage>
              )}
            </div>
          </div>

          {/* Property panel */}
          <div className="col-span-12 lg:col-span-3 border rounded-lg bg-card p-3">
            <h3 className="text-sm font-medium mb-2">Properties</h3>
            {!selectedItem ? (
              <p className="text-xs text-muted-foreground">Select an item on the plan to edit.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium truncate">{selectedItem.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{selectedItem.brand}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Width (cm)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedItem.w_cm)}
                      onChange={(e) => setItems((arr) => arr.map((p) => p.id === selectedItem.id ? { ...p, w_cm: parseFloat(e.target.value) || 0 } : p))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Depth (cm)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedItem.d_cm)}
                      onChange={(e) => setItems((arr) => arr.map((p) => p.id === selectedItem.id ? { ...p, d_cm: parseFloat(e.target.value) || 0 } : p))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">X (cm)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedItem.x_cm)}
                      onChange={(e) => setItems((arr) => arr.map((p) => p.id === selectedItem.id ? { ...p, x_cm: parseFloat(e.target.value) || 0 } : p))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Y (cm)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedItem.y_cm)}
                      onChange={(e) => setItems((arr) => arr.map((p) => p.id === selectedItem.id ? { ...p, y_cm: parseFloat(e.target.value) || 0 } : p))}
                      className="h-8"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">Rotation: {Math.round(selectedItem.rotation)}°</Label>
                  <Slider
                    value={[selectedItem.rotation]}
                    min={0} max={359} step={1}
                    onValueChange={([v]) => setItems((arr) => arr.map((p) => p.id === selectedItem.id ? { ...p, rotation: v } : p))}
                  />
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setItems((arr) => arr.map((p) => p.id === selectedItem.id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))}>
                    <RotateCw className="w-3.5 h-3.5 mr-1" />90°
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setItems((arr) => [...arr, { ...selectedItem, id: NEW_ID(), x_cm: selectedItem.x_cm + 20, y_cm: selectedItem.y_cm + 20 }])}>
                    <Copy className="w-3.5 h-3.5 mr-1" />Duplicate
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { setItems((arr) => arr.filter((p) => p.id !== selectedItem.id)); setSelectedId(null); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <h4 className="text-xs font-medium mb-2">Items on plan ({items.length})</h4>
              <ScrollArea className="h-[180px]">
                <ol className="text-xs space-y-1">
                  {items.map((it, idx) => (
                    <li
                      key={it.id}
                      className={`px-2 py-1 rounded cursor-pointer ${selectedId === it.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
                      onClick={() => setSelectedId(it.id)}
                    >
                      {idx + 1}. <span className="truncate">{it.label}</span>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>

      {/* Calibration distance dialog */}
      <Dialog open={calibDialogOpen} onOpenChange={setCalibDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set scale</DialogTitle>
            <DialogDescription>
              Enter the real-world distance between the two points you clicked.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-muted-foreground" />
            <Input
              type="number"
              placeholder="e.g. 300"
              value={calibDistanceCm}
              onChange={(e) => setCalibDistanceCm(e.target.value)}
              autoFocus
            />
            <span className="text-sm text-muted-foreground">cm</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCalibDialogOpen(false); setCalibPoints([]); }}>Cancel</Button>
            <Button onClick={finishCalibration}>Set scale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
