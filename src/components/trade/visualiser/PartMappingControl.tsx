import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clearPartOverrides, setPartOverride, useModelMeshes, usePartGroupLabels, usePartOverrides, type PartAssignment } from "@/lib/visualiserPartMapping";
import { isNamedFinishTarget, targetLabel, type FinishTarget } from "@/lib/visualiserFinishTargets";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";

/**
 * Groups a model's coded meshes by finish target (Frame, Upholstery…) — one row
 * per group, never one dropdown per raw mesh. Reassigning a group moves every
 * mesh in it, so a single swatch then textures them all together.
 */
export default function PartMappingControl({ productId, targets, labels }: { productId: string; targets: FinishTarget[]; labels: Record<string, string> }) {
  const meshes = useModelMeshes(productId);
  const overrides = usePartOverrides(productId);
  const groups = { ...usePartGroupLabels(productId), ...labels };
  const OPTIONS: { value: PartAssignment; label: string }[] = [
    { value: "none", label: "Whole Piece only" },
    ...targets.filter((target) => target !== "all" && isNamedFinishTarget(target, groups))
      .map((target) => ({ value: target as PartAssignment, label: targetLabel(target, groups) })),
  ];
  const labelFor = (v: string) => targetLabel(v as FinishTarget, groups);
  const [open, setOpen] = useState(false);
  if (meshes.length === 0) return null;
  const hasOverrides = Object.keys(overrides).length > 0;

  const grouped = new Map<string, typeof meshes>();
  for (const mesh of meshes) {
    const role = (overrides[mesh.key] ?? mesh.auto ?? "none") as string;
    if (!targets.includes(role as FinishTarget) || !isNamedFinishTarget(role, groups)) continue;
    grouped.set(role, [...(grouped.get(role) ?? []), mesh]);
  }
  if (grouped.size === 0) return null;
  const moveGroup = (members: typeof meshes, next: PartAssignment) => {
    for (const mesh of members) setPartOverride(productId, mesh.key, next === (mesh.auto ?? "none") ? null : next);
  };

  return (
    <div className="mt-4 border-t border-foreground/10 pt-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" className={cn(microLabel, "h-auto p-0 text-muted-foreground hover:text-foreground")} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "−" : "+"} Finish groups ({grouped.size})
        </Button>
        {hasOverrides && (
          <Button variant="ghost"
            className={cn(microLabel, "h-auto p-0 text-muted-foreground hover:text-foreground")}
            onClick={() => clearPartOverrides(productId)}
            title="Clear manual part mappings and use the model's default finish roles"
          >
            Reset mappings
          </Button>
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
