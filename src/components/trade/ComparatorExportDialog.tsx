import { FileDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ComparatorExportOptions } from "@/lib/comparatorExport";

export function ComparatorExportDialog({ open, onOpenChange, options, onChange, tradeAllowed, generating, error, onGenerate }: {
  open: boolean; onOpenChange: (open: boolean) => void; options: ComparatorExportOptions;
  onChange: (options: ComparatorExportOptions) => void; tradeAllowed: boolean; generating: boolean;
  error: string | null; onGenerate: () => void;
}) {
  return <Dialog open={open} onOpenChange={value => { if (!generating) onOpenChange(value); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-xl font-normal">Export comparison PDF</DialogTitle><DialogDescription className="sr-only">Choose the document audience and included details.</DialogDescription></DialogHeader>
      <fieldset disabled={generating} className="space-y-4">
        <legend className="sr-only">Presentation mode</legend>
        <label className="flex cursor-pointer items-start gap-3 border-b border-border pb-4">
          <input type="radio" name="comparison-export-mode" value="client" checked={options.mode === "client"} onChange={() => onChange({ ...options, mode: "client", trade: false })} className="mt-1 accent-primary" />
          <span className="min-w-0"><span className="block text-sm font-medium">Client Presentation Mode</span><span className="mt-2 flex items-start gap-1.5 text-sm font-medium text-primary"><Lock className="mt-0.5 h-4 w-4 shrink-0" /><span>Client-Safe. Automatically hides Trade Prices, markups, and internal supplier names.</span></span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="radio" name="comparison-export-mode" value="internal" checked={options.mode === "internal"} onChange={() => onChange({ ...options, mode: "internal" })} className="mt-1 accent-primary" />
          <span className="min-w-0"><span className="block text-sm font-medium">Internal Working Document</span><span className="mt-1 block text-sm text-muted-foreground">Includes full cost breakdowns, trade pricing, and internal procurement notes.</span></span>
        </label>
      </fieldset>
      <div className="divide-y divide-border border-y border-border">
        {([
          ["retail", "Show Retail Price"], ["trade", "Show Trade Price"],
          ["logistics", "Show Lead Times & Dimensions"], ["materials", "Show Item Finishes & Materials"],
        ] as const).map(([key, label]) => <div key={key} className="flex items-center justify-between gap-4 py-3">
          <Label htmlFor={`export-${key}`} className="text-sm font-normal">{label}</Label>
          <Switch id={`export-${key}`} checked={key === "trade" ? options.mode === "internal" && tradeAllowed && options.trade : options[key]} disabled={generating || (key === "trade" && (options.mode === "client" || !tradeAllowed))} onCheckedChange={checked => onChange({ ...options, [key]: checked })} />
        </div>)}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={generating} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={generating} onClick={onGenerate}><FileDown className="h-4 w-4" />{generating ? "Preparing PDF…" : "Generate & Download PDF"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}