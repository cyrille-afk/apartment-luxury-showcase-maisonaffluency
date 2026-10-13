import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteScenePreset, readScenePresets, saveScenePreset, type ScenePreset, type ScenePresetData } from "@/lib/visualiserScenePresets";

interface Props {
  className: string;
  current: () => ScenePresetData;
  onLoad: (data: ScenePresetData) => void;
}

const ScenePresets = ({ className, current, onLoad }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [presets, setPresets] = useState<ScenePreset[]>(() => readScenePresets());

  const save = () => {
    const data = current();
    if (!data.objects.length) { toast.error("Add at least one piece before saving a preset"); return; }
    const saved = saveScenePreset(name, data);
    if (!saved) { toast.error("Couldn't save — the room photo is too large for browser storage. Try a smaller image."); return; }
    setPresets(saved);
    toast.success(`Saved "${name.trim()}"`);
    setName("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setPresets(readScenePresets()); }}>
      <PopoverTrigger asChild>
        <button className={className} title="Save or reopen named furniture arrangements">[ &#9733; Scene Presets ]</button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end" side="top">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Preset name" className="h-8 text-xs" aria-label="Preset name" />
          <Button type="submit" size="sm" className="h-8" disabled={!name.trim()}>Save</Button>
        </form>
        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {presets.length === 0 && <p className="text-xs text-muted-foreground">No presets yet.</p>}
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => { onLoad(p.data); setOpen(false); toast.success(`Opened "${p.name}"`); }}
              >
                <span className="block truncate text-xs font-medium">{p.name}</span>
                <span className="block text-[10px] text-muted-foreground">{p.data.objects.length} pieces · {new Date(p.savedAt).toLocaleDateString()}</span>
              </button>
              <button aria-label={`Delete ${p.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => setPresets(deleteScenePreset(p.id))}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ScenePresets;
