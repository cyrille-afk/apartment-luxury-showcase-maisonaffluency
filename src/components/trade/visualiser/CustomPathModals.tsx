import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PathMode, StorageMode } from "@/lib/customCameraPaths";

type Option<T extends string> = { value: T; label: string; sub: string; disabled?: boolean };

function ChoiceCard<T extends string>({ open, onOpenChange, title, options, customValue, initial, primary, onPrimary, onBack, onSkip }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; options: Option<T>[]; customValue: T; initial: T;
  primary: string; onPrimary: (value: T, text?: string) => void; onBack?: () => void; onSkip: () => void;
}) {
  const [value, setValue] = useState<T>(initial);
  const [text, setText] = useState("");
  const all = [...options, { value: customValue, label: "", sub: "" }];
  const index = all.findIndex((o) => o.value === value);
  const step = (d: number) => {
    for (let i = 1; i <= all.length; i++) {
      const next = all[(index + d * i + all.length * i) % all.length];
      if (next && !("disabled" in next && next.disabled)) { setValue(next.value); return; }
    }
  };
  const canSubmit = value !== customValue || text.trim().length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-5 p-6">
        <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
        <DialogDescription className="sr-only">Choose one option</DialogDescription>
        <div role="radiogroup" aria-label={title} className="space-y-2">
          {options.map((o) => (
            <label key={o.value} className={`flex cursor-pointer gap-3 border p-3 transition-colors ${value === o.value ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/20"} ${o.disabled ? "cursor-not-allowed opacity-50" : ""}`}>
              <input type="radio" name={title} className="mt-1 accent-foreground" checked={value === o.value} disabled={o.disabled} onChange={() => setValue(o.value)} />
              <span><span className="block text-sm font-medium">{o.label}</span><span className="block text-xs text-muted-foreground">{o.sub}</span></span>
            </label>
          ))}
          <label className={`flex items-center gap-3 border p-3 ${value === customValue ? "border-foreground bg-muted/40" : "border-border"}`}>
            <input type="radio" name={title} className="accent-foreground" checked={value === customValue} onChange={() => setValue(customValue)} aria-label="Write your own" />
            <Input value={text} maxLength={1000} placeholder="Write your own..." className="h-8 text-sm"
              onFocus={() => setValue(customValue)} onChange={(e) => { setText(e.target.value); setValue(customValue); }} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" aria-label="Previous option" onClick={() => (onBack ? onBack() : step(-1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Next option" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="link" className="ml-auto text-muted-foreground" onClick={onSkip}>Skip all</Button>
          <Button disabled={!canSubmit} onClick={() => onPrimary(value, value === customValue ? text.trim() : undefined)}>{primary}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CustomPathBuilderModal({ open, onOpenChange, onPathModeSelect }: {
  open: boolean; onOpenChange: (o: boolean) => void; onPathModeSelect: (mode: PathMode, customText?: string) => void;
}) {
  return <ChoiceCard<PathMode> open={open} onOpenChange={onOpenChange} title="How do you want to build a custom path?" initial="capture" customValue="text" primary="Next"
    options={[
      { value: "capture", label: "Capture viewpoints", sub: "Move the 3D view where you like, click 'Add viewpoint'; the camera glides through them in order. Reorder/delete points." },
      { value: "draw", label: "Draw on floor plan", sub: "Click points on a top-down plan, set height per point. More setup, less intuitive for framing." },
    ]}
    onPrimary={onPathModeSelect} onSkip={() => onOpenChange(false)} />;
}

export function PathStoragePreferencesModal({ open, onOpenChange, layoutSaved, onStoragePreferenceSubmit, onBack }: {
  open: boolean; onOpenChange: (o: boolean) => void; layoutSaved: boolean; onBack?: () => void;
  onStoragePreferenceSubmit: (mode: StorageMode, customText?: string) => void;
}) {
  return <ChoiceCard<StorageMode> open={open} onOpenChange={onOpenChange} title="Where should saved paths live?" initial={layoutSaved ? "layout" : "account"} customValue="custom" primary="Submit"
    options={[
      { value: "layout", label: "With the layout", sub: layoutSaved ? "Saved in your account per layout; available on any device and in shared/exported renders." : "Save the layout first to use this option.", disabled: !layoutSaved },
      { value: "account", label: "Your account, reusable", sub: "A personal library usable across all layouts (points may not suit other rooms)." },
      { value: "local", label: "This browser only", sub: "Quickest; lost on other devices." },
    ]}
    onPrimary={onStoragePreferenceSubmit} onBack={onBack} onSkip={() => onOpenChange(false)} />;
}
