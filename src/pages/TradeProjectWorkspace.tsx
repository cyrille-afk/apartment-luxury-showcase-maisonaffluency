import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Map, Layers, Armchair, Eye, Image, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SourceUpload from "@/components/trade/SourceUpload";
import { ActiveProjectProvider, useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { WorkspaceView } from "@/lib/activeProjectLayout";
const Sandbox = lazy(() => import("./TradeVisualiser"));
const Axonometric = lazy(() => import("./TradeAxonometric"));

function WorkspacePanels() {
  const project = useActiveProject();
  const [visited, setVisited] = useState(false);
  const [imageStudio, setImageStudio] = useState(false);
  useEffect(() => { if (project?.view !== "plan") setVisited(true); }, [project?.view]);
  if (!project) return null;
  const { view, setView, state } = project;
  const tabs: { value: WorkspaceView; label: string; icon: typeof Map }[] = [{ value: "plan", label: "2D Layout Plan", icon: Map }, { value: "axonometric", label: "Axonometric Studio", icon: Layers }, { value: "sandbox", label: "Eye-Level Sandbox", icon: Armchair }];
  return <div className="flex h-full min-h-0 flex-col bg-background">
    <div role="tablist" aria-label="Project workspace views" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:px-6">
      {tabs.map(tab => <Button key={tab.value} id={`workspace-${tab.value}`} role="tab" aria-selected={view === tab.value} aria-controls={`panel-${tab.value}`} variant="ghost" className={cn("shrink-0 rounded-none border-b-2 text-xs sm:text-sm", view === tab.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground")} onClick={() => setView(tab.value)}><tab.icon className="h-4 w-4" />{tab.label}</Button>)}
    </div>
    <section id="panel-plan" role="tabpanel" aria-labelledby="workspace-plan" hidden={view !== "plan"} className={cn("min-h-0 flex-1 overflow-y-auto p-4 sm:p-6", view !== "plan" && "hidden")}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4"><h1 className="font-display text-2xl">2D Layout Plan</h1><SourceUpload folder="axonometric-sources" label="Upload floor plan" onSourceReady={project.setFloorPlanUrl} /></div>
      <div className="mb-4 flex flex-wrap items-end gap-4">{(["width", "depth", "height"] as const).map(axis => <div key={axis} className="w-28 space-y-1"><Label htmlFor={`room-${axis}`} className="capitalize">{axis} (m)</Label><Input id={`room-${axis}`} type="number" min="2" max="100" step="0.1" value={state.bounds[axis]} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 2 && value <= 100) project.setBounds(current => ({ ...current, [axis]: value })); }} /></div>)}<Button variant="outline" onClick={() => setView("axonometric")}><Layers className="h-4 w-4" />Open Axonometric Studio</Button></div>
      {state.floorPlanUrl ? <img src={state.floorPlanUrl} alt="Active project floor plan" className="max-h-[65dvh] w-full object-contain" /> : <div className="flex min-h-64 items-center justify-center border border-dashed border-border text-muted-foreground"><Upload className="h-6 w-6" /></div>}
    </section>
    <div id={`panel-${view === "sandbox" ? "sandbox" : "axonometric"}`} role="tabpanel" aria-labelledby={`workspace-${view === "sandbox" ? "sandbox" : "axonometric"}`} hidden={view === "plan"} className={cn("flex min-h-0 flex-1 flex-col", view === "plan" && "hidden")}>
      {view === "axonometric" && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2"><span className="text-xs text-muted-foreground">{state.placedItems.length} placed pieces · {state.bounds.width} × {state.bounds.depth} m</span><div className="flex gap-2"><Button variant="ghost" size="sm" aria-pressed={imageStudio} onClick={() => setImageStudio(value => !value)}><Image className="h-4 w-4" />Image Studio</Button><Button size="sm" onClick={() => { setImageStudio(false); setView("sandbox"); }}><Eye className="h-4 w-4" />Step Inside Room</Button></div></div>}
      <div className={cn("min-h-0 flex-1", imageStudio && view === "axonometric" && "hidden")}><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Opening workspace…</div>}>{visited && <Sandbox />}</Suspense></div>
      <div className={cn("min-h-0 flex-1 overflow-auto", (!imageStudio || view !== "axonometric") && "hidden")}><Suspense fallback={<div className="p-6">Opening Image Studio…</div>}>{imageStudio && <Axonometric />}</Suspense></div>
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