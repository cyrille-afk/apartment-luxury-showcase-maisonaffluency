import { useState } from "react";
import { Loader2, Orbit, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type View = { label: string; azimuth: number; elevation: number };

// Quick-fill presets. Selecting one replaces the current list with its angles.
const PRESETS: { id: string; name: string; views: View[] }[] = [
  {
    id: "4-corners",
    name: "4 corners (default)",
    views: [
      { label: "Front-Left", azimuth: 45, elevation: 30 },
      { label: "Front-Right", azimuth: 135, elevation: 30 },
      { label: "Back-Right", azimuth: 225, elevation: 30 },
      { label: "Back-Left", azimuth: 315, elevation: 30 },
    ],
  },
  {
    id: "3-hero",
    name: "3 hero angles",
    views: [
      { label: "Hero", azimuth: 45, elevation: 30 },
      { label: "Top-Down", azimuth: 0, elevation: 85 },
      { label: "Eye-Level", azimuth: 45, elevation: 5 },
    ],
  },
  {
    id: "6-orbit",
    name: "6-step orbit",
    views: [
      { label: "0°", azimuth: 0, elevation: 30 },
      { label: "60°", azimuth: 60, elevation: 30 },
      { label: "120°", azimuth: 120, elevation: 30 },
      { label: "180°", azimuth: 180, elevation: 30 },
      { label: "240°", azimuth: 240, elevation: 30 },
      { label: "300°", azimuth: 300, elevation: 30 },
    ],
  },
  {
    id: "2-compare",
    name: "2-up compare",
    views: [
      { label: "Front", azimuth: 45, elevation: 30 },
      { label: "Top-Down", azimuth: 0, elevation: 85 },
    ],
  },
];

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(Number.isFinite(v) ? v : min)));

interface MultiViewTurntableProps {
  sourceImageUrl: string | null | undefined;
  triggerLabel?: string;
}

export function MultiViewTurntable({ sourceImageUrl, triggerLabel = "Multi-View" }: MultiViewTurntableProps) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<View[]>(PRESETS[0].views);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) setViews(p.views.map((v) => ({ ...v })));
  };

  const updateView = (i: number, patch: Partial<View>) => {
    setViews((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };

  const addView = () => {
    if (views.length >= 6) return;
    setViews((prev) => [...prev, { label: `View ${prev.length + 1}`, azimuth: 45, elevation: 30 }]);
  };

  const removeView = (i: number) => {
    setViews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const generate = async () => {
    if (!sourceImageUrl) {
      toast({ title: "No source render", description: "Generate a base scene first.", variant: "destructive" });
      return;
    }
    if (views.length < 2) {
      toast({ title: "Need at least 2 views", variant: "destructive" });
      return;
    }
    if (views.length > 6) {
      toast({ title: "Maximum 6 views per call", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResultUrl(null);
    try {
      const n = views.length;
      const gridLayout = n === 4 ? "2x2" : n === 6 ? "3x2" : `${n}x1`;
      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: {
          mode: "multi_view",
          imageUrl: sourceImageUrl,
          views: views.map((v) => ({
            label: v.label.trim() || `View`,
            azimuth: clampInt(v.azimuth, 0, 360),
            elevation: clampInt(v.elevation, 0, 90),
          })),
          gridLayout,
          qualityTier: "standard",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const url = data?.storedUrl || data?.imageUrl;
      if (!url) throw new Error("No image returned");
      setResultUrl(url);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!resultUrl) return;
    try {
      const resp = await fetch(resultUrl);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `multi-view-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(resultUrl, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!sourceImageUrl}>
          <Orbit className="w-3.5 h-3.5 mr-1.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Multi-View Turntable</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            All selected angles are rendered in a single batched call to keep furniture, materials and lighting
            consistent across views.
          </p>

          {/* Preset quick-fill */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Preset</Label>
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Load a preset…" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Editable view list */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_88px_88px_32px] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
              <span>Label</span>
              <span>Azimuth °</span>
              <span>Elevation °</span>
              <span />
            </div>
            {views.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_88px_88px_32px] gap-2 items-center">
                <Input
                  value={v.label}
                  onChange={(e) => updateView(i, { label: e.target.value })}
                  className="h-8 text-xs"
                  placeholder={`View ${i + 1}`}
                />
                <Input
                  type="number"
                  min={0}
                  max={360}
                  value={v.azimuth}
                  onChange={(e) => updateView(i, { azimuth: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={v.elevation}
                  onChange={(e) => updateView(i, { elevation: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeView(i)}
                  disabled={views.length <= 2}
                  aria-label="Remove view"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addView}
              disabled={views.length >= 6}
              className="w-full"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add view ({views.length}/6)
            </Button>
            <p className="text-[10px] text-muted-foreground px-1">
              Azimuth = compass rotation (0–360°). Elevation = camera tilt (0° eye-level, 90° top-down).
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              N = {views.length} · grid {views.length === 4 ? "2×2" : views.length === 6 ? "3×2" : `${views.length}×1`}
            </Label>
            <div className="flex gap-2">
              {resultUrl && (
                <Button variant="outline" size="sm" onClick={download}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download
                </Button>
              )}
              <Button size="sm" onClick={generate} disabled={loading || !sourceImageUrl}>
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Rendering…
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </div>
          </div>

          <div className="aspect-square w-full rounded-md border border-border/60 bg-muted/20 overflow-hidden flex items-center justify-center">
            {loading ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Batching {views.length} consistent views…
              </div>
            ) : resultUrl ? (
              <img src={resultUrl} alt="Multi-view turntable" className="w-full h-full object-contain" />
            ) : (
              <div className="text-xs text-muted-foreground">Result will appear here</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
