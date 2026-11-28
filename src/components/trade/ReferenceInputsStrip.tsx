import { useState } from "react";
import { CheckCircle2, ChevronDown, AlertTriangle } from "lucide-react";
import type { PreparedReferenceInput } from "@/lib/productReferenceImages";

export type ReferenceStrip = { baseUrl: string; baseLabel: string; inputs: (PreparedReferenceInput & { verified: boolean })[] };

export default function ReferenceInputsStrip({ strip }: { strip: ReferenceStrip }) {
  const [open, setOpen] = useState(false);
  const verified = strip.inputs.filter(i => i.verified).length;
  const allVerified = verified === strip.inputs.length;
  return (
    <div className="rounded-md border border-border bg-muted/10" data-testid="reference-inputs-strip">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[11px] text-foreground">
        {allVerified ? <CheckCircle2 className="size-3.5 shrink-0 text-primary" /> : <AlertTriangle className="size-3.5 shrink-0 text-destructive" />}
        <span className="min-w-0 flex-1 truncate">{allVerified ? "Reference Inputs Verified" : "Reference inputs not fully confirmed"} · {verified}/{strip.inputs.length} product photos sent to the AI</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex gap-2 overflow-x-auto border-t border-border px-3 py-2">
          <figure className="w-20 shrink-0">
            <img src={strip.baseUrl} alt={strip.baseLabel} className="aspect-square w-full rounded border border-border bg-background object-cover" />
            <figcaption className="mt-1 font-body text-[9px] leading-tight text-muted-foreground">Ref 1 · {strip.baseLabel}</figcaption>
          </figure>
          {strip.inputs.map(input => (
            <figure key={input.reference} className="w-20 shrink-0">
              <img src={input.dataUrl} alt={input.product_name} className={`aspect-square w-full rounded border bg-background object-contain ${input.verified ? "border-border" : "border-destructive"}`} />
              <figcaption className="mt-1 font-body text-[9px] leading-tight text-muted-foreground">
                Ref {input.reference} · {input.product_name}{input.verified ? "" : " — not confirmed"}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
