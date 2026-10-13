import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PlacedObject } from "./SceneObject";
import { deleteFinishPreset, listFinishPresets, saveFinishPreset, type FinishPreset } from "@/lib/visualiserFinishPresets";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";

/** Save / restore named finish configurations for the selected piece's product. */
const FinishPresets = ({ object, onRestore }: { object: PlacedObject; onRestore: (preset: FinishPreset) => void }) => {
  const [presets, setPresets] = useState<FinishPreset[]>(() => listFinishPresets(object.id));
  const [name, setName] = useState("");
  useEffect(() => setPresets(listFinishPresets(object.id)), [object.id]);

  const hasFinish = Boolean(object.material || object.topMaterial || object.baseMaterial || object.upholsteryMaterial || Object.values(object.partMaterials ?? {}).some(Boolean));
  const save = () => {
    if (!name.trim()) return;
    setPresets(saveFinishPreset(object.id, {
      name,
      material: object.material ?? null,
      topMaterial: object.topMaterial ?? null,
      baseMaterial: object.baseMaterial ?? null,
      upholsteryMaterial: object.upholsteryMaterial ?? null,
      partMaterials: object.partMaterials ?? {},
    }));
    toast.success(`Saved “${name.trim()}”`);
    setName("");
  };

  return (
    <div className="mt-4 border-t border-foreground/10 pt-3" data-testid="finish-presets">
      <p className={cn(microLabel, "text-muted-foreground")}>Saved configurations</p>
      {presets.length > 0 && (
        <ul className="mt-2 space-y-1">
          {presets.map((preset) => (
            <li key={preset.name} className="flex items-center justify-between gap-2">
              <button onClick={() => onRestore(preset)} className={cn(microLabel, "truncate text-left text-foreground hover:underline")} title="Restore configuration">
                {preset.name}
              </button>
              <button aria-label={`Delete ${preset.name}`} onClick={() => setPresets(deleteFinishPreset(object.id, preset.name))} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={hasFinish ? "Name this configuration" : "Apply a finish first"}
          disabled={!hasFinish}
          aria-label="Configuration name"
          className="min-w-0 flex-1 border-b border-foreground/10 bg-transparent pb-1 text-xs outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button onClick={save} disabled={!hasFinish || !name.trim()} className={cn(microLabel, "text-foreground disabled:text-muted-foreground")}>Save</button>
      </div>
    </div>
  );
};

export default FinishPresets;
