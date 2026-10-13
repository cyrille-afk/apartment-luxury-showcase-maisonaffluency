import { useState } from "react";
import { cn } from "@/lib/utils";
import { clearPartOverrides, setPartOverride, useModelMeshes, usePartGroupLabels, usePartOverrides, type PartAssignment } from "@/lib/visualiserPartMapping";
import { KNOWN_PARTS, KNOWN_PART_LABELS } from "@/lib/visualiserFinishTargets";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";
const BASE_OPTIONS: { value: PartAssignment; label: string }[] = [
  { value: "none", label: "Whole Piece only" },
  ...KNOWN_PARTS.map((p) => ({ value: p as PartAssignment, label: KNOWN_PART_LABELS[p] })),
];

/** Manually assigns unnamed/coded model parts to finish tabs; saved per product. */
export default function PartMappingControl({ productId }: { productId: string }) {
  const meshes = useModelMeshes(productId);
  const overrides = usePartOverrides(productId);
  const groups = usePartGroupLabels(productId);
  const OPTIONS = [...BASE_OPTIONS, ...Object.entries(groups).map(([value, label]) => ({ value: value as PartAssignment, label }))];
  const [open, setOpen] = useState(false);
  if (meshes.length === 0) return null;
  return (
    <div className="mt-4 border-t border-foreground/10 pt-3">
      <button className={cn(microLabel, "text-muted-foreground hover:text-foreground")} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "−" : "+"} Map model parts ({meshes.length})
      </button>
      {open && (
        <ul className="mt-3 space-y-2" data-testid="part-mapping">
          {meshes.map((mesh, i) => {
            const override = overrides[mesh.key];
            const value = override ?? mesh.auto ?? "none";
            return (
              <li key={mesh.key} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground" title={mesh.label}>
                  {mesh.label || `Part ${i + 1}`}{!override && mesh.auto ? " · auto" : ""}
                </span>
                <select
                  aria-label={`Finish tab for ${mesh.label || `part ${i + 1}`}`}
                  value={value}
                  onChange={(e) => {
                    const next = e.target.value as PartAssignment;
                    setPartOverride(productId, mesh.key, next === (mesh.auto ?? "none") ? null : next);
                  }}
                  className="border border-foreground/15 bg-background px-2 py-1 text-xs"
                >
                  {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
