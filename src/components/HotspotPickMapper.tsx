import { useMemo, useState } from "react";
import { sortNameKey } from "@/lib/nameFormat";

export interface HotspotPickOption { id: string; title: string; designer: string; image_url: string | null }

/** Designer A–Z → that designer's products. Picking a product returns it so the
 *  caller can fill name/designer/image instead of retyping. */
export default function HotspotPickMapper({ options, value, onChange }: {
  options: HotspotPickOption[];
  value: string;
  onChange: (pick: HotspotPickOption | null) => void;
}) {
  const current = options.find(o => o.id === value);
  const [designer, setDesigner] = useState(current?.designer ?? "");
  const designers = useMemo(
    () => Array.from(new Set(options.map(o => o.designer))).sort((a, b) => sortNameKey(a).localeCompare(sortNameKey(b))),
    [options],
  );
  const products = useMemo(
    () => options.filter(o => o.designer === designer).sort((a, b) => a.title.localeCompare(b.title)),
    [options, designer],
  );
  const cls = "w-full text-xs border border-primary/20 rounded px-2 py-1.5 font-body bg-white focus:outline-hidden focus:ring-1 focus:ring-primary/30";
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Link to catalogue product</label>
      <select aria-label="Designer A–Z" value={designer} onChange={e => { setDesigner(e.target.value); onChange(null); }} className={cls}>
        <option value="">Designer A–Z{options.length ? ` (${designers.length})` : " — loading…"}</option>
        {designers.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      {designer && (
        <select aria-label="Product" value={value} onChange={e => onChange(products.find(p => p.id === e.target.value) ?? null)} className={cls}>
          <option value="">Choose product ({products.length})</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      )}
    </div>
  );
}
