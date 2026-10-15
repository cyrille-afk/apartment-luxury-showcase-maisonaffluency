import { Gem, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clampMarbleSurface, DEFAULT_MARBLE_SURFACE, type MarbleSurfaceSettings } from "@/lib/visualiserMarbleSettings";

type Table = { instanceId: string; product_name: string; marbleSurface?: MarbleSurfaceSettings };
type Props = { className?: string; tables: Table[]; selectedId: string | null; onSelect: (id: string) => void; onChange: (id: string, settings: MarbleSurfaceSettings) => void };

export default function MarbleSurfaceControls({ className, tables, selectedId, onSelect, onChange }: Props) {
  const table = tables.find((item) => item.instanceId === selectedId) ?? tables[0];
  const settings = clampMarbleSurface(table?.marbleSurface);
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" className={className} disabled={!table} aria-label="Coffee table marble controls"><Gem className="mr-2 h-3.5 w-3.5" />Marble</Button></PopoverTrigger>
    <PopoverContent side="top" align="start" className="z-[80] w-80 max-w-[calc(100vw-2rem)] space-y-5" aria-label="Coffee table marble controls">
      <h3 className="text-sm font-medium">Coffee table marble</h3>
      {table && <Select value={table.instanceId} onValueChange={onSelect}><SelectTrigger aria-label="Coffee table"><SelectValue /></SelectTrigger><SelectContent className="z-[90]">{tables.map((item, index) => <SelectItem key={item.instanceId} value={item.instanceId}>{item.product_name}{tables.filter((other) => other.product_name === item.product_name).length > 1 ? ` · ${index + 1}` : ""}</SelectItem>)}</SelectContent></Select>}
      {(["reflectivity", "roughness"] as const).map((key) => <div key={key} className="space-y-3">
        <div className="flex items-center justify-between text-xs"><span>{key === "reflectivity" ? "Reflectivity" : "Roughness"}</span><output className="tabular-nums text-muted-foreground">{Math.round(settings[key] * 100)}%</output></div>
        <Slider thumbLabel={`Marble ${key}`} min={0} max={100} step={1} value={[settings[key] * 100]} onValueChange={([value]) => { if (table && value !== undefined) onChange(table.instanceId, { ...settings, [key]: value / 100 }); }} />
      </div>)}
      <div className="border-t border-border pt-3"><Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { if (table) onChange(table.instanceId, { ...DEFAULT_MARBLE_SURFACE }); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset marble</Button></div>
    </PopoverContent>
  </Popover>;
}