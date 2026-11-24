import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select";

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
  const pick = (role: BoardAxisRole, value: string, colourName: string | null) => {
    const next = variants.find(v => v.axes?.every(a => a.role === role ? a.value === value : a.value === variant.axes?.find(old => old.role === a.role)?.value)) ?? variants.find(v => v.axes?.some(a => a.role === role && a.value === value));
    if (!next) return;
    const nextColours = Object.fromEntries((next.axes ?? []).flatMap(a => {
      const wanted = a.role === role ? colourName : colours[a.role]?.name;
      const retained = a.colours.find(c => c.name === wanted) ?? a.colours[0];
      return retained ? [[a.role, retained]] : [];
    }));
    setVariant(next); setColours(nextColours); onChange(next, nextColours);
  };
  return <div className="space-y-5">{(variant.axes ?? []).map(axis => {
    const ranges = new Map<string, BoardAxisColour[]>();
    for (const v of variants) for (const a of v.axes ?? []) if (a.role === axis.role && a.value && !ranges.has(a.value)) ranges.set(a.value, a.colours);
    const current = colours[axis.role];
    const currentKey = `${axis.value ?? ""}::${current?.name ?? ""}`;
    return <div key={axis.role} className="space-y-2">
      <p className="font-body text-xs text-muted-foreground">{axis.label}</p>
      <Select value={currentKey} onValueChange={key => { const [value, name] = key.split("::"); if (value) pick(axis.role, value, name || null); }}>
        <SelectTrigger aria-label={axis.label}><span className="flex min-w-0 items-center gap-2">{current?.image_url && <img src={current.image_url} alt="" className="size-5 shrink-0 rounded-full object-cover" />}<span className="truncate">{current?.name ?? (axis.value === "COM" ? "Customer’s own material" : axis.value)}</span></span></SelectTrigger>
        <SelectContent>{[...ranges].map(([value, list]) => <SelectGroup key={value}><SelectLabel>{value === "COM" ? "COM · Customer’s own material" : value}</SelectLabel>
          {list.length ? list.map(c => <SelectItem key={c.name} value={`${value}::${c.name}`}><span className="flex items-center gap-2">{c.image_url && <img src={c.image_url} alt="" className="size-5 rounded-full object-cover" />}{c.name}</span></SelectItem>)
            : <SelectItem value={`${value}::`}>{value === "COM" ? "Customer’s own material" : `${value} (colour on request)`}</SelectItem>}
        </SelectGroup>)}</SelectContent>
      </Select>
    </div>;
  })}</div>;
}
