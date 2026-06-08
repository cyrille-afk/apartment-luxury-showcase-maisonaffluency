import { useState } from "react";
import { Loader2, Orbit, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type View = { id: string; label: string; azimuth: number; elevation: number };

// Curated angle presets. Each angle is sent verbatim to the model and rendered
// as one cell of a single composite contact sheet, so all cells share the
// exact same furniture, materials and lighting.
const PRESET_VIEWS: View[] = [
  { id: "front-left", label: "Front-Left", azimuth: 45, elevation: 30 },
  { id: "front-right", label: "Front-Right", azimuth: 135, elevation: 30 },
  { id: "back-right", label: "Back-Right", azimuth: 225, elevation: 30 },
  { id: "back-left", label: "Back-Left", azimuth: 315, elevation: 30 },
  { id: "top-down", label: "Top-Down", azimuth: 0, elevation: 85 },
  { id: "eye-level", label: "Eye-Level", azimuth: 45, elevation: 5 },
];

const DEFAULT_SELECTED = new Set(["front-left", "front-right", "back-right", "back-left"]);

interface MultiViewTurntableProps {
  /** Source render the turntable should match (storedUrl or imageUrl). */
  sourceImageUrl: string | null | undefined;
  /** Optional custom trigger button content. */
  triggerLabel?: string;
}

export function MultiViewTurntable({ sourceImageUrl, triggerLabel = "Multi-View" }: MultiViewTurntableProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = async () => {
    if (!sourceImageUrl) {
      toast({ title: "No source render", description: "Generate a base scene first.", variant: "destructive" });
      return;
    }
    const views = PRESET_VIEWS.filter((v) => selected.has(v.id));
    if (views.length < 2) {
      toast({ title: "Pick at least 2 angles", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResultUrl(null);
    try {
      const gridLayout = views.length === 4 ? "2x2" : views.length === 6 ? "3x2" : `${views.length}x1`;
      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: {
          mode: "multi_view",
          imageUrl: sourceImageUrl,
          views: views.map(({ label, azimuth, elevation }) => ({ label, azimuth, elevation })),
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Multi-View Turntable</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Renders all selected angles in a single batched call so furniture, materials and lighting stay
            consistent across views.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_VIEWS.map((v) => (
              <label
                key={v.id}
                className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 cursor-pointer hover:bg-muted/30"
              >
                <Checkbox checked={selected.has(v.id)} onCheckedChange={() => toggle(v.id)} />
                <div className="flex-1">
                  <div className="text-sm">{v.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    az {v.azimuth}° · el {v.elevation}°
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              {selected.size} angle{selected.size === 1 ? "" : "s"} selected
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
                Batching {selected.size} consistent views…
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
