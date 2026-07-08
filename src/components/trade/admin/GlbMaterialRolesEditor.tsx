import { useEffect, useState } from "react";
import { Loader2, Check, Eye, EyeOff, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type MaterialRole = "fabric" | "base" | "top" | "ignore";

/**
 * Heuristic name-based role detection. Returns null when the material name is
 * opaque (UUID-like, generic "Material_23", etc.) and no confident guess can
 * be made — in which case the admin must tag it manually.
 *
 * Token buckets are ordered by specificity: "tabletop" before "table" before
 * "top" so a mesh named "table_base" doesn't get mis-tagged as a top.
 */
export function autoDetectRoleFromName(rawName: string): MaterialRole | null {
  const name = rawName.toLowerCase();
  // Reject opaque CAD IDs (long hex, uuid fragments, "material_23").
  if (/^[0-9a-f]{8,}(-[0-9a-f]+)*$/i.test(rawName)) return null;
  if (/^(mesh|material|object|node)[_\-]?\d+$/i.test(rawName)) return null;

  const has = (...tokens: string[]) =>
    tokens.some((t) => new RegExp(`(^|[^a-z])${t}([^a-z]|$)`, "i").test(name));

  // Fabric first — upholstery is unambiguous.
  if (has("fabric", "upholstery", "cushion", "seat", "leather", "textile", "cloth")) return "fabric";

  // Top: slab / surface / stone-family keywords.
  if (
    has("tabletop", "table_top", "top", "surface", "slab", "worktop", "counter") ||
    has("marble", "onyx", "stone", "granite", "travertine", "quartz", "glass")
  )
    return "top";

  // Base: structural / leg / frame keywords.
  if (
    has("base", "frame", "leg", "legs", "plinth", "foot", "footing", "pedestal", "support", "structure", "chassis") ||
    has("brass", "metal", "steel", "bronze", "iron", "wood", "oak", "walnut", "ash")
  )
    return "base";

  return null;
}

interface Props {
  variantId: string;
  materialNames: string[];
  initialRoles: Record<string, MaterialRole> | null | undefined;
  /** Called with the current role map on every change (so parent viewer re-applies textures live). */
  onChange: (roles: Record<string, MaterialRole>) => void;
  /** Called after a successful DB save with the persisted map. */
  onSaved?: (roles: Record<string, MaterialRole>) => void;
  /**
   * When set, the parent viewer should flash this single material in a bright
   * highlight colour so the admin can visually identify which mesh a given
   * (usually opaque) material name maps to. Null clears the highlight.
   */
  onIdentifyChange?: (materialName: string | null) => void;
  /** The currently-identified material, controlled by the parent. */
  identifying?: string | null;
}

const ROLE_LABEL: Record<MaterialRole, string> = {
  fabric: "Fabric / Leather",
  base: "Base (wood · metal)",
  top: "Top (stone · marble · glass)",
  ignore: "Ignore",
};

const ROLE_ORDER: MaterialRole[] = ["fabric", "base", "top", "ignore"];

export function GlbMaterialRolesEditor({
  variantId,
  materialNames,
  initialRoles,
  onChange,
  onSaved,
  onIdentifyChange,
  identifying,
}: Props) {
  const [roles, setRoles] = useState<Record<string, MaterialRole>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Rebuild the working map whenever the variant / discovered names change.
  useEffect(() => {
    const hasSaved = !!initialRoles && Object.keys(initialRoles).length > 0;
    const next: Record<string, MaterialRole> = {};
    let autoTagged = 0;
    for (const name of materialNames) {
      const existing = initialRoles?.[name];
      if (existing) {
        next[name] = existing;
      } else {
        const guess = autoDetectRoleFromName(name);
        next[name] = guess ?? "ignore";
        if (guess) autoTagged += 1;
      }
    }
    setRoles(next);
    // If nothing was ever saved and we auto-tagged at least one mesh, mark
    // dirty so the admin can just review + hit Save.
    setDirty(!hasSaved && autoTagged > 0);
    onChange(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, materialNames.join("|")]);

  const setRole = (name: string, role: MaterialRole) => {
    const next = { ...roles, [name]: role };
    setRoles(next);
    setDirty(true);
    onChange(next);
  };

  const runAutoDetect = () => {
    const next: Record<string, MaterialRole> = { ...roles };
    let changed = 0;
    for (const name of materialNames) {
      const guess = autoDetectRoleFromName(name);
      if (guess && next[name] !== guess) {
        next[name] = guess;
        changed += 1;
      }
    }
    if (changed === 0) {
      toast.info("No confident matches found — tag manually.");
      return;
    }
    setRoles(next);
    setDirty(true);
    onChange(next);
    toast.success(`Auto-detected ${changed} material${changed === 1 ? "" : "s"} from names`);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("trade_product_glb_variants")
      .update({ material_roles: roles })
      .eq("id", variantId);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save material roles: ${error.message}`);
      return;
    }
    toast.success("Material roles saved");
    setDirty(false);
    onSaved?.(roles);
  };

  if (materialNames.length === 0) {
    return (
      <div className="mt-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 font-body text-[10px] text-muted-foreground">
        Waiting for the GLB to load to detect materials…
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Material roles ({materialNames.length})
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-body text-[10px] uppercase tracking-[0.12em] transition-colors bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          {dirty ? "Save" : "Saved"}
        </button>
      </div>
      <div className="space-y-1.5">
        {materialNames.map((name) => {
          const isId = identifying === name;
          return (
            <div key={name} className="flex items-center gap-2">
              {onIdentifyChange && (
                <button
                  type="button"
                  onClick={() => onIdentifyChange(isId ? null : name)}
                  title={isId ? "Stop highlighting" : "Flash this mesh in the 3D viewer"}
                  className={`shrink-0 p-1 rounded border transition-colors ${
                    isId
                      ? "bg-fuchsia-600 text-white border-fuchsia-600"
                      : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {isId ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
              )}
              <div className="flex-1 min-w-0 font-mono text-[10px] text-foreground/80 truncate" title={name}>
                {name || "(unnamed)"}
              </div>
              <div className="flex gap-1 shrink-0">
                {ROLE_ORDER.map((r) => {
                  const active = roles[name] === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(name, r)}
                      className={`px-2 py-0.5 rounded font-body text-[9px] uppercase tracking-[0.12em] transition-colors border ${
                        active
                          ? r === "fabric"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : r === "base"
                              ? "bg-amber-700 text-white border-amber-700"
                              : "bg-muted text-foreground border-border"
                          : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="font-body text-[9px] text-muted-foreground leading-relaxed">
        Tag which materials receive the fabric swatch, which receive the base
        (wood / stone / metal) swatch, and which stay as-is. Tap the
        <Eye size={9} className="inline mx-0.5 -mt-0.5" /> icon to flash a mesh
        in the 3D viewer so you can tell opaque CAD IDs apart. Required
        whenever the GLB's material names are opaque IDs.
      </p>
    </div>
  );
}

export default GlbMaterialRolesEditor;
