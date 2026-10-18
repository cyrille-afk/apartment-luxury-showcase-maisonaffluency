import { useState } from "react";
import { Map, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

export default function ProjectLayoutOverview() {
  const project = useActiveProject();
  const [open, setOpen] = useState(false);
  if (!project || project.view !== "sandbox") return null;
  const { bounds, placedItems } = project.state;
  return <div className="absolute bottom-16 right-3 z-30 sm:right-6">
    {open ? <aside aria-label="Layout overview" className="w-64 max-w-[80vw] rounded-sm border border-border bg-background/95 p-3 shadow-sm backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">Layout Overview</h2><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close layout overview" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
      <svg role="img" aria-label={`Floor plan with ${placedItems.length} pieces`} viewBox={`0 0 ${bounds.width} ${bounds.depth}`} className="mb-3 aspect-[3/2] w-full border border-border bg-muted text-foreground">
        <rect x="0.05" y="0.05" width={bounds.width - 0.1} height={bounds.depth - 0.1} fill="none" stroke="currentColor" strokeWidth="0.07" />
        {placedItems.map(item => <g key={item.id} transform={`translate(${item.x + bounds.width / 2} ${item.y + bounds.depth / 2}) rotate(${-item.rotation * 180 / Math.PI})`}><rect x="-0.35" y="-0.3" width="0.7" height="0.6" rx="0.04" fill="currentColor" opacity="0.6" /><title>{item.name}</title></g>)}
      </svg>
      <p className="mb-2 text-xs text-muted-foreground">{bounds.width} × {bounds.depth} m · {placedItems.length} pieces</p>
      <Button variant="outline" size="sm" className="w-full" onClick={() => project.setView("axonometric")}><Layers className="h-4 w-4" />Switch to Top-Down Layout</Button>
    </aside> : <Button variant="outline" size="sm" className="bg-background/95" onClick={() => setOpen(true)}><Map className="h-4 w-4" />Layout Overview</Button>}
  </div>;
}