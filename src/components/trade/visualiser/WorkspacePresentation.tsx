import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Map, Layers, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspacePresentation as Presentation } from "@/lib/workspacePresentation";
import SharedVisualiserScene from "./SharedVisualiserScene";
const noop = () => {};
export default function WorkspacePresentation({ data }: { data: Presentation }) {
  const [active, setActive] = useState(data.floorPlanUrl ? "plan" : data.views[0]?.id || "plan");
  const view = data.views.find(v => v.id === active);
  const [failedPlan, setFailedPlan] = useState<string | null>(null);
  const plan = active === "plan" ? data.floorPlanUrl : view?.floorPlanUrl;
  return <div className="min-h-screen bg-background text-foreground">
    <Helmet><title>{data.title} — {data.studioName || "Private project"}</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <header className="mx-auto max-w-6xl px-6 pt-12 pb-8 text-center">
      {data.studioLogo && <img src={data.studioLogo} alt={data.studioName} className="mx-auto mb-5 h-14 max-w-full object-contain" />}
      <p className="text-xs uppercase text-muted-foreground">{data.studioName}</p>
      <h1 className="mt-3 break-words font-display text-3xl">{data.title}</h1>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Read-only presentation</p>
    </header>
    <nav aria-label="Saved workspace views" className="mx-auto flex max-w-6xl flex-wrap gap-2 border-y border-border px-6 py-4">
      {data.floorPlanUrl && <Button variant={active === "plan" ? "default" : "outline"} onClick={() => setActive("plan")}><Map className="h-4 w-4" />Floor plan</Button>}
      {data.views.map(v => <Button key={v.id} variant={active === v.id ? "default" : "outline"} className="h-auto min-h-10 whitespace-normal text-left" onClick={() => setActive(v.id)}><Layers className="h-4 w-4 shrink-0" />{v.name}</Button>)}
    </nav>
    <main className="py-8">
      {view && <div className="mx-auto mb-6 max-w-6xl px-6"><h2 className="font-display text-2xl">{view.name}</h2><p className="mt-2 text-xs text-muted-foreground">{view.bounds.width} × {view.bounds.depth} m · {new Date(view.created_at).toLocaleDateString("en-GB")}</p></div>}
      {plan && <div className="mx-auto mb-8 max-w-6xl px-6">{failedPlan === plan ? <p role="alert" className="text-sm text-muted-foreground">The floor plan is unavailable. Please contact your designer.</p> : <img src={plan} alt="Project floor plan" onError={() => setFailedPlan(plan)} className="max-h-[70dvh] w-full object-contain" />}</div>}
      {view?.scene && <SharedVisualiserScene key={view.id} room={view.scene} readOnly onSelectPiece={noop} onApprove={async () => {}} approved={false} approvalDisabled />}
      {active === "plan" && !data.floorPlanUrl && <div className="mx-auto max-w-6xl px-6"><Button variant="outline" onClick={() => { const first = data.views[0]; if (first) setActive(first.id); }}><Layers className="h-4 w-4" />Open saved room</Button></div>}
    </main>
  </div>;
}