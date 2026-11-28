import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { planPoint, type ProposalProduct, type EyeLevelTarget } from "@/lib/proposalRenderDraft";

export default function EyeLevelPlacementShell({ url, products, disabled, onTarget, onRemove }: { url: string; products: ProposalProduct[]; disabled: boolean; onTarget: (id: string, target: EyeLevelTarget | null) => void; onRemove?: ((id: string) => void) | undefined }) {
  const [activeId, setActiveId] = useState(products[0]?.id ?? "");
  const drag = useRef<string | null>(null);
  const active = products.find(p => p.id === activeId) ?? products[0];
  const place = (id: string, x: number, y: number) => {
    const piece = products.find(p => p.id === id);
    if (piece) onTarget(id, { x, y, instruction: piece.target?.instruction ?? "" });
  };
  return <div className="space-y-3">
    <Label htmlFor="placement-piece">{active?.category_role === "artwork" ? "Wall target artwork" : "Placement product"}</Label>
    <Select value={active?.id ?? ""} onValueChange={setActiveId} disabled={disabled || !products.length}><SelectTrigger id="placement-piece" className="h-auto min-h-9 text-left [&>span]:whitespace-normal"><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map((p, i) => <SelectItem key={p.id} value={p.id}>Pin {i + 1}: {p.product_name}</SelectItem>)}</SelectContent></Select>
    <div className="relative overflow-hidden rounded-md border border-border bg-muted/10">
      <img src={url} alt="Eye-level room placement image" className="block w-full" draggable={false} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="group" aria-label="Furniture placement pins" className="absolute inset-0 h-full w-full touch-none text-primary"
        onPointerDown={e => { if (disabled || !active) return; const id = (e.target as Element).closest("[data-piece-id]")?.getAttribute("data-piece-id") ?? active.id; drag.current = id; setActiveId(id); e.currentTarget.setPointerCapture(e.pointerId); const pt = planPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()); place(id, pt.x, pt.y); }}
        onPointerMove={e => { if (!drag.current || disabled) return; const pt = planPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()); place(drag.current, pt.x, pt.y); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {products.map((piece, i) => piece.target && <g key={piece.id} data-piece-id={piece.id} role="slider" tabIndex={disabled ? -1 : 0} aria-label={`Pin ${i + 1}: ${piece.product_name}`} aria-valuetext={`${piece.target.x.toFixed(1)}%, ${piece.target.y.toFixed(1)}%`} className="cursor-move focus:outline-none"
          onKeyDown={e => { const target = piece.target; if (!target || disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault(); setActiveId(piece.id); place(piece.id, Math.max(0, Math.min(100, target.x + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0))), Math.max(0, Math.min(100, target.y + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0)))); }}>
          <circle cx={piece.target.x} cy={piece.target.y} r="3" fill="currentColor" stroke="var(--background)" strokeWidth="0.5" />
          <text x={piece.target.x} y={piece.target.y} dy="1.1" textAnchor="middle" fill="var(--primary-foreground)" fontSize="3.2" className="pointer-events-none">{i + 1}</text>
        </g>)}
      </svg>
    </div>
    {products.map((piece, i) => <div key={piece.id} className="space-y-1">
      <div className="flex items-center justify-between gap-2"><Label htmlFor={`placement-note-${piece.id}`} className="text-xs">Pin {i + 1}: {piece.product_name}</Label><div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon-sm" title="Clear placement pin only" aria-label={`Remove pin ${i + 1}`} disabled={disabled || !piece.target} onClick={() => onTarget(piece.id, null)}><Trash2 /></Button>{onRemove && <Button variant="outline" size="sm" aria-label={`Remove piece ${i + 1}: ${piece.product_name}`} disabled={disabled} onClick={() => onRemove(piece.id)}><Trash2 className="size-3.5" />Remove piece</Button>}</div></div>
      <p className="text-xs text-muted-foreground">{piece.target ? `${piece.category_role === "artwork" ? "Wall centre · " : ""}${piece.target.x.toFixed(1)}%, ${piece.target.y.toFixed(1)}%` : piece.category_role === "rug" ? "Floor · beneath coffee table and front chair legs" : piece.category_role === "artwork" ? "Wall target not placed" : "Not placed"} · {piece.dimensions || "Dimensions unconfirmed"}</p>
      <Input id={`placement-note-${piece.id}`} disabled={disabled || !piece.target} maxLength={300} value={piece.target?.instruction ?? ""} placeholder="Optional note, e.g. flush against solid left wall" onChange={e => { if (piece.target) onTarget(piece.id, { ...piece.target, instruction: e.target.value }); }} />
    </div>)}
  </div>;
}