import { useEffect, useState } from "react";
import { Loader2, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type MaterialRole = "fabric" | "base" | "ignore";

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
  fabric: "Fabric",
  base: "Base / Wood",
  ignore: "Ignore",
};

const ROLE_ORDER: MaterialRole[] = ["fabric", "base", "ignore"];

export function GlbMaterialRolesEditor({
  variantId,
  materialNames,
  initialRoles,
  onChange,
  onSaved,
}: Props) {
  const [roles, setRoles] = useState<Record<string, MaterialRole>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Rebuild the working map whenever the variant / discovered names change.
  useEffect(() => {
    const next: Record<string, MaterialRole> = {};
    for (const name of materialNames) {
      const existing = initialRoles?.[name];
      next[name] = existing ?? "ignore";
    }
    setRoles(next);
    setDirty(false);
    onChange(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, materialNames.join("|")]);

  const setRole = (name: string, role: MaterialRole) => {
    const next = { ...roles, [name]: role };
    setRoles(next);
    setDirty(true);
    onChange(next);
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
        {materialNames.map((name) => (
          <div key={name} className="flex items-center gap-2">
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
        ))}
      </div>
      <p className="font-body text-[9px] text-muted-foreground leading-relaxed">
        Tag which materials receive the fabric swatch, which receive the base
        (wood / stone / metal) swatch, and which stay as-is. Required whenever
        the GLB's material names are opaque IDs from the CAD tool.
      </p>
    </div>
  );
}

export default GlbMaterialRolesEditor;
