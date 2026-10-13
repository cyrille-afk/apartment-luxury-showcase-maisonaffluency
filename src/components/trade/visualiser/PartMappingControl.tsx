import { useState } from "react";
import { cn } from "@/lib/utils";
import { clearPartOverrides, setPartOverride, useModelMeshes, usePartGroupLabels, usePartOverrides, type PartAssignment } from "@/lib/visualiserPartMapping";
import { KNOWN_PARTS, KNOWN_PART_LABELS } from "@/lib/visualiserFinishTargets";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";
const BASE_OPTIONS: { value: PartAssignment; label: string }[] = [
  { value: "none", label: "Whole Piece only" },
  ...KNOWN_PARTS.map((p) => ({ value: p as PartAssignment, label: KNOWN_PART_LABELS[p] })),
];

/**
 * Groups a model's coded meshes by finish target (Frame, Upholstery…) — one row
 * per group, never one dropdown per raw mesh. Reassigning a group moves every
 * mesh in it, so a single swatch then textures them all together.
 */
export default function PartMappingControl({ productId }: { productId: string }) {
  const meshes = useModelMeshes(productId);
  const overrides = usePartOverrides(productId);
  const groups = usePartGroupLabels(productId);
  const OPTIONS = [...BASE_OPTIONS, ...Object.entries(groups).map(([value, label]) => ({ value: value as PartAssignment, label }))];
  const labelFor = (v: string) => OPTIONS.find((o) => o.value === v)?.label ?? v;
  const [open, setOpen] = useState(false);
  if (meshes.length === 0) return null;
  const hasOverrides = Object.keys(overrides).length > 0;

  const grouped = new Map<string, typeof meshes>();
  for (const mesh of meshes) {
    const role = (overrides[mesh.key] ?? mesh.auto ?? "none") as string;
    grouped.set(role, [...(grouped.get(role) ?? []), mesh]);
  }
  const moveGroup = (members: typeof meshes, next: PartAssignment) => {
    for (const mesh of members) setPartOverride(productId, mesh.key, next === (mesh.auto ?? "none") ? null : next);
  };

  return (
    <div className="mt-4 border-t border-foreground/10 pt-3">
      <div className="flex items-center justify-between gap-2">
        <button className={cn(microLabel, "text-muted-foreground hover:text-foreground")} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "−" : "+"} Finish groups ({grouped.size})
        </button>
        {hasOverrides && (
          <button
            className={cn(microLabel, "text-muted-foreground hover:text-foreground")}
            onClick={() => clearPartOverrides(productId)}
            title="Clear manual part mappings and use the model's default finish roles"
          >
            Reset mappings
          </button>
        )}
      </div>
      {open && (
        <ul className="mt-3 space-y-2" data-testid="part-mapping">
          {[...grouped.entries()].map(([role, members]) => (
            <li key={role} className="flex items-center justify-between gap-2">
              <span className={cn(microLabel, "truncate text-foreground")} title={members.map((m) => m.label).filter(Boolean).join(", ")}>
                {labelFor(role)} <span className="text-muted-foreground">· {members.length} {members.length === 1 ? "part" : "parts"}</span>
              </span>
              <select
                aria-label={`Move ${labelFor(role)} group to finish tab`}
                value={role}
                onChange={(e) => moveGroup(members, e.target.value as PartAssignment)}
                className="border border-foreground/15 bg-background px-2 py-1 text-xs"
              >
                {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
