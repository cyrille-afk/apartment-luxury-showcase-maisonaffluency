import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Map, Layers, Armchair, Eye, Image, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SourceUpload from "@/components/trade/SourceUpload";
import WorkspaceShare from "@/components/trade/WorkspaceShare";
import LayoutPlanCanvas from "@/components/trade/visualiser/LayoutPlanCanvas";
import ProjectAssetsDrawer from "@/components/trade/visualiser/ProjectAssetsDrawer";
import { ActiveProjectProvider, useActiveProject } from "@/contexts/ActiveProjectContext";
import { useProjectInventory, type ProjectInventoryItem } from "@/contexts/ProjectInventoryContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { patchLayoutItem, type WorkspaceView } from "@/lib/activeProjectLayout";
import { createPlacedObject, MAX_PLACED_OBJECTS, type PlaceableProduct } from "@/lib/placedObjectFactory";
import { resolveDimensions } from "@/lib/productDimensions";
import { DEFAULT_SLOT_SPACING, footprintRadius, pickFootprintSlot } from "@/lib/visualiserPlacement";
const Sandbox = lazy(() => import("./TradeVisualiser"));
const Axonometric = lazy(() => import("./TradeAxonometric"));

const inventoryItemToPlaceable = (item: ProjectInventoryItem): PlaceableProduct => ({
  id: item.id,
  product_name: item.productName,
  brand_name: item.brandName,
  image_url: item.imageUrl,
  dimensions: item.dimensions,
  glb_url: item.glbUrl,
});

function WorkspacePanels() {
  const { isAdmin } = useAuth();
  const project = useActiveProject();
  const { projectInventory } = useProjectInventory();
  const [visited, setVisited] = useState(false);
  const [imageStudio, setImageStudio] = useState(false);
  const [imageVisited, setImageVisited] = useState(false);
  const [planSelectedId, setPlanSelectedId] = useState<string | null>(null);
  useEffect(() => { if (imageStudio) setImageVisited(true); }, [imageStudio]);
  useEffect(() => { if (project?.view !== "plan") setVisited(true); }, [project?.view]);
  if (!project) return null;
  const { view, setView, state } = project;

  // Single spawn path for the 2D plan: drop coordinates (or a free slot for
  // click-to-place) become the piece's layout (x, y) instantly, and the shared
  // objects array carries it straight into the Axonometric Studio 3D scene.
  const placeInventoryItem = (item: ProjectInventoryItem, at?: [number, number]) => {
    if (project.objects.length >= MAX_PLACED_OBJECTS) {
      toast.error(`This composition can hold up to ${MAX_PLACED_OBJECTS} objects.`);
      return;
    }
    const placeable = inventoryItemToPlaceable(item);
    const position: [number, number, number] = at
      ? [at[0], 0, at[1]]
      : (() => {
          const [x, y] = pickFootprintSlot(
            project.objects.map((o) => ({ position: o.position, radius: footprintRadius(resolveDimensions(o), o.scale) })),
            footprintRadius(resolveDimensions(placeable)),
            DEFAULT_SLOT_SPACING,
            [0, 0],
          );
          return [x, 0, y];
        })();
    const next = createPlacedObject(placeable, position);
    project.setObjects((current) => [...current, next]);
    setPlanSelectedId(next.instanceId);
    toast.success(`${item.productName} placed on the layout.`);
  };

  const handlePlanDrop = (key: string, x: number, y: number) => {
    const item = projectInventory.find((entry) => `${entry.id}::${entry.variantLabel ?? ""}` === key);
    if (item) placeInventoryItem(item, [x, y]);
  };

  const tabs: { value: WorkspaceView; label: string; icon: typeof Map }[] = [{ value: "plan", label: "2D Layout Plan", icon: Map }, { value: "axonometric", label: "Axonometric Studio", icon: Layers }, { value: "sandbox", label: "Eye-Level Sandbox", icon: Armchair }];
  return <div className="flex h-full min-h-0 flex-col bg-background">
    <div role="tablist" aria-label="Project workspace views" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:px-6">
      {tabs.map(tab => <Button key={tab.value} id={`workspace-${tab.value}`} role="tab" aria-selected={view === tab.value} aria-controls={`panel-${tab.value}`} variant="ghost" className={cn("shrink-0 rounded-none border-b-2 text-xs sm:text-sm", view === tab.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground")} onClick={() => setView(tab.value)}><tab.icon className="h-4 w-4" />{tab.label}</Button>)}
      <div className="ml-auto flex items-center"><WorkspaceShare /></div>
    </div>
    <section id="panel-plan" role="tabpanel" aria-labelledby="workspace-plan" hidden={view !== "plan"} className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", view !== "plan" && "hidden")}>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-4 pt-4 sm:px-6"><h1 className="font-display text-2xl">2D Layout Plan</h1><SourceUpload folder="axonometric-sources" label="Upload floor plan" onSourceReady={project.setFloorPlanUrl} /></div>
      <div className="flex shrink-0 flex-wrap items-end gap-4 px-4 py-4 sm:px-6">{(["width", "depth", "height"] as const).map(axis => <div key={axis} className="w-28 space-y-1"><Label htmlFor={`room-${axis}`} className="capitalize">{axis} (m)</Label><Input id={`room-${axis}`} type="number" min="2" max="100" step="0.1" value={state.bounds[axis]} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 2 && value <= 100) project.setBounds(current => ({ ...current, [axis]: value })); }} /></div>)}<Button variant="outline" onClick={() => setView("axonometric")}><Layers className="h-4 w-4" />Open Axonometric Studio</Button></div>
      <div className="relative min-h-0 flex-1 border-t border-border">
        <LayoutPlanCanvas
          objects={project.objects}
          bounds={state.bounds}
          floorPlanUrl={state.floorPlanUrl}
          selectedId={planSelectedId}
          onSelect={setPlanSelectedId}
          onMove={(instanceId, x, y) => project.setObjects(current => patchLayoutItem(current, instanceId, { x, y }))}
          onDropAssetKey={handlePlanDrop}
        />
        <ProjectAssetsDrawer anchorClassName="left-3 top-3 sm:left-4" onPlace={(item) => placeInventoryItem(item)} />
        {!state.floorPlanUrl && project.objects.length === 0 && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 text-muted-foreground"><Upload className="h-4 w-4" /><span className="text-xs">Upload a floor plan as underlay, or drag pieces in</span></div>
        )}
      </div>
    </section>
    <div id={`panel-${view === "sandbox" ? "sandbox" : "axonometric"}`} role="tabpanel" aria-labelledby={`workspace-${view === "sandbox" ? "sandbox" : "axonometric"}`} hidden={view === "plan"} className={cn("flex min-h-0 flex-1 flex-col", view === "plan" && "hidden")}>
      {view === "axonometric" && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2"><span className="text-xs text-muted-foreground">{state.placedItems.length} placed pieces · {state.bounds.width} × {state.bounds.depth} m</span><div className="flex gap-2">{isAdmin && <Button variant="ghost" size="sm" aria-pressed={imageStudio} onClick={() => setImageStudio(value => !value)}><Image className="h-4 w-4" />Image Studio</Button>}<Button size="sm" onClick={() => { setImageStudio(false); setView("sandbox"); }}><Eye className="h-4 w-4" />Step Inside Room</Button></div></div>}
      <div className={cn("min-h-0 flex-1", imageStudio && view === "axonometric" && "hidden")}><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Opening workspace…</div>}>{visited && <Sandbox />}</Suspense></div>
      <div className={cn("min-h-0 flex-1 overflow-auto", (!imageStudio || view !== "axonometric") && "hidden")}><Suspense fallback={<div className="p-6">Opening Image Studio…</div>}>{imageVisited && <Axonometric />}</Suspense></div>
    </div>
  </div>;
}
export default function TradeProjectWorkspace() {
  const { user } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const projectId = params.get("project") || "sandbox";
  const initialView: WorkspaceView = location.pathname.endsWith("axonometric") ? "axonometric" : "sandbox";
  return <ActiveProjectProvider key={`${user?.id || "guest"}:${projectId}`} accountId={user?.id || "guest"} projectId={projectId} initialView={initialView}><WorkspacePanels /></ActiveProjectProvider>;
}
