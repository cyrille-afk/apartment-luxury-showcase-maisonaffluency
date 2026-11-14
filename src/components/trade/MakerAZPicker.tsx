import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
/** Accent-folded first letter; digits/symbols group under "#". */
export const makerInitial = (name: string) => {
  const c = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

export function MakerAZPicker({ makers, value, onChange }: { makers: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const present = useMemo(() => new Set(makers.map(makerInitial)), [makers]);
  const shown = letter ? makers.filter(m => makerInitial(m) === letter) : makers;
  const pick = (v: string) => { onChange(v); setOpen(false); };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label="Brand or maker" className="flex h-8 w-full items-center justify-between border border-input bg-background px-3 font-body text-xs">
        <span className="truncate">{value || "All brands / makers"}</span><ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
      <div role="group" aria-label="Filter makers by letter" className="flex flex-wrap gap-0.5 border-b border-border p-2">
        <button type="button" onClick={() => setLetter(null)} aria-pressed={letter === null}
          className={cn("h-6 px-1.5 text-[10px] uppercase tracking-[0.1em]", letter === null ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>All</button>
        {LETTERS.map(l => <button key={l} type="button" disabled={!present.has(l)} onClick={() => setLetter(l)} aria-pressed={letter === l}
          className={cn("h-6 w-6 text-[11px]", letter === l ? "bg-foreground text-background" : "text-foreground hover:bg-muted", "disabled:cursor-default disabled:text-muted-foreground/40 disabled:hover:bg-transparent")}>{l}</button>)}
      </div>
      <div className="max-h-80 overflow-y-auto py-1">
        {!letter && <Row label="All brands / makers" active={!value} onClick={() => pick("")} />}
        {shown.map(m => <Row key={m} label={m} active={value === m} onClick={() => pick(m)} />)}
      </div>
    </PopoverContent>
  </Popover>;
}

function Row({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left font-serif text-sm hover:bg-muted", active && "bg-muted")}>
    <Check className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-0")} />{label}
  </button>;
}
