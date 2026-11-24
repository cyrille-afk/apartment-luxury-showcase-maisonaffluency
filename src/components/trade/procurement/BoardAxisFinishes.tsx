import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type BoardAxisRole = "seat" | "backrest" | "frame";
export type BoardAxisColour = { name: string; image_url: string | null; category?: string | null };
export type BoardFinishAxis = { role: BoardAxisRole; label: string; value: string | null; colours: BoardAxisColour[] };
export type BoardAxisVariant = { top?: string; base?: string; label?: string; price_cents?: number; axes?: BoardFinishAxis[] };
export type BoardAxisSelection = { label: string; price_cents: number | null; image_url: string | null; top?: string | null; base?: string | null; top_image?: string | null; base_image?: string | null; extra?: { name: string; img: string | null }[] };
const normal = (value?: string | null) => (value ?? "").normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
export function readBoardAxisNames(label?: string | null): Partial<Record<BoardAxisRole, string>> {
  const result: Partial<Record<BoardAxisRole, string>> = {};
  for (const part of (label ?? "").split(" · ")) {
    const match = part.match(/^(Seat Upholstery|Backrest Upholstery|Frame Finish):\s*(.+)$/i);
    if (!match?.[1] || !match[2]) continue;
    const role = /^seat/i.test(match[1]) ? "seat" : /^backrest/i.test(match[1]) ? "backrest" : "frame";
    result[role] = match[2].trim();
  }
  return result;
}
const titles: Record<BoardAxisRole, string> = { seat: "Seat Upholstery", backrest: "Backrest Upholstery", frame: "Frame Finish" };
const matches = (axis: BoardFinishAxis, name?: string) => !name || normal(axis.value) === normal(name) || axis.colours.some(c => normal(c.name) === normal(name));
export function resolveBoardAxisSelection(label: string, variants: BoardAxisVariant[], image: string | null = null): BoardAxisSelection | null {
  const names = readBoardAxisNames(label);
  if (!names.seat || !names.backrest || !names.frame) return null;
  const pool = variants.filter(v => v.axes?.every(axis => matches(axis, names[axis.role])) && v.axes.length === 3);
  const selected = pool[0];
  const colour = (role: BoardAxisRole) => selected?.axes?.find(a => a.role === role)?.colours.find(c => normal(c.name) === normal(names[role]));
  const prices = new Set(pool.map(v => v.price_cents));
  return { label, price_cents: prices.size === 1 ? selected?.price_cents ?? null : null, image_url: image, top: names.seat, base: names.frame, top_image: colour("seat")?.image_url ?? null, base_image: colour("frame")?.image_url ?? null, extra: [{ name: names.backrest, img: colour("backrest")?.image_url ?? null }] };
}
export function boardAxisSelection(variant: BoardAxisVariant, colours: Partial<Record<BoardAxisRole, BoardAxisColour>>, image: string | null): BoardAxisSelection {
  const axes = variant.axes ?? [];
  const name = (role: BoardAxisRole) => colours[role]?.name ?? axes.find(a => a.role === role)?.value ?? "";
  const label = (["seat", "backrest", "frame"] as const).map(role => `${titles[role]}: ${name(role)}`).join(" · ");
  return { label, price_cents: variant.price_cents ?? null, image_url: image, top: name("seat"), base: name("frame"), top_image: colours.seat?.image_url ?? null, base_image: colours.frame?.image_url ?? null, extra: [{ name: name("backrest"), img: colours.backrest?.image_url ?? null }] };
}

export default function BoardAxisFinishes({ variants, initial, onChange }: { variants: BoardAxisVariant[]; initial: BoardAxisSelection | null; onChange: (variant: BoardAxisVariant, colours: Partial<Record<BoardAxisRole, BoardAxisColour>>) => void }) {
  const names = readBoardAxisNames(initial?.label);
  const initialVariant = variants.find(v => v.axes?.every(a => matches(a, names[a.role]))) ?? variants[0];
  const [variant, setVariant] = useState(initialVariant);
  const [colours, setColours] = useState<Partial<Record<BoardAxisRole, BoardAxisColour>>>(() => Object.fromEntries((initialVariant?.axes ?? []).flatMap(a => { const colour = a.colours.find(c => normal(c.name) === normal(names[a.role])) ?? a.colours[0]; return colour ? [[a.role, colour]] : []; })));
  if (!variant) return null;
  return <div className="space-y-5">{(variant.axes ?? []).map(axis => <div key={axis.role} className="space-y-2">
    <p className="font-body text-xs text-muted-foreground">{axis.label}</p>
    <Select value={axis.value ?? ""} onValueChange={value => {
      const next = variants.find(v => v.axes?.every(a => a.role === axis.role ? a.value === value : a.value === variant.axes?.find(old => old.role === a.role)?.value)) ?? variants.find(v => v.axes?.some(a => a.role === axis.role && a.value === value));
      if (!next) return;
      const nextColours = Object.fromEntries((next.axes ?? []).flatMap(a => { const retained = a.colours.find(c => c.name === colours[a.role]?.name) ?? a.colours[0]; return retained ? [[a.role, retained]] : []; }));
      setVariant(next); setColours(nextColours); onChange(next, nextColours);
    }}><SelectTrigger aria-label={axis.label}><SelectValue /></SelectTrigger><SelectContent>{[...new Set(variants.flatMap(v => v.axes?.filter(a => a.role === axis.role).map(a => a.value).filter((v): v is string => !!v) ?? []))].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
    {axis.colours.length > 0 && <div role="radiogroup" aria-label={`${axis.label} colour`} className="flex flex-wrap gap-2">{axis.colours.map(colour => <Button key={colour.name} variant="outline" size="icon" role="radio" aria-checked={colours[axis.role]?.name === colour.name} aria-label={colour.name} title={colour.name} className={`size-9 overflow-hidden rounded-full p-0 ${colours[axis.role]?.name === colour.name ? "ring-1 ring-foreground ring-offset-2 ring-offset-background" : ""}`} onClick={() => { const next = { ...colours, [axis.role]: colour }; setColours(next); onChange(variant, next); }}>{colour.image_url && <img src={colour.image_url} alt="" className="size-full object-cover" />}</Button>)}</div>}
    <p className="font-body text-xs text-muted-foreground">{colours[axis.role]?.name ?? (axis.value === "COM" ? "Customer’s own material" : axis.value)}</p>
  </div>)}</div>;
}