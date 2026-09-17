import { useRef } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface PODocumentData {
  po_number: string;
  quote_ref: string;
  product_name: string;
  brand_name: string;
  quantity: number;
  client_name?: string | null;
  project_name?: string | null;
  cost_code?: string | null;
  sku?: string | null;
  dimensions?: string | null;
  materials?: string | null;
  lead_time?: string | null;
  required_by_date?: string | null;
  price_cents?: number | null;
  currency?: string | null;
}

interface Props {
  document: PODocumentData | null;
  onOpenChange: (open: boolean) => void;
}

const money = (cents: number | null | undefined, currency: string) =>
  cents == null
    ? "Price upon Request"
    : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);

const longDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function PODocumentViewer({ document: po, onOpenChange }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  /** Print the document sheet alone, via an isolated iframe so the app behind stays untouched. */
  const print = () => {
    const node = sheetRef.current;
    if (!node) return;
    const frame = window.document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    window.document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    const styles = Array.from(window.document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join("");
    doc.open();
    doc.write(
      `<!doctype html><html><head><title>${po?.po_number || "Purchase Order"}</title>${styles}` +
        `<style>@page{size:A4;margin:14mm}body{background:#fff;margin:0}</style></head>` +
        `<body>${node.outerHTML}</body></html>`,
    );
    doc.close();
    const run = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1000);
    };
    if (frame.contentWindow?.document.readyState === "complete") window.setTimeout(run, 250);
    else frame.onload = () => window.setTimeout(run, 250);
  };

  const currency = po?.currency || "EUR";
  const lineTotal = po?.price_cents != null ? po.price_cents * po.quantity : null;

  return (
    <Dialog open={!!po} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-h-[92dvh] w-[min(96vw,900px)] max-w-none gap-0 overflow-hidden p-0"
      >
        {po && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
              <div>
                <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Purchase order</p>
                <p className="font-display text-base text-foreground">{po.po_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="font-body text-xs" onClick={print}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print / Download PDF
                </Button>
                <Button variant="ghost" size="sm" className="font-body text-xs" onClick={() => onOpenChange(false)}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Close view
                </Button>
              </div>
            </div>

            <div className="max-h-[calc(92dvh-56px)] overflow-y-auto bg-muted/40 p-4 sm:p-8">
              <div ref={sheetRef} className="mx-auto w-full max-w-[794px] bg-background p-8 shadow-sm sm:p-12">
                <header className="flex items-start justify-between gap-6 border-b border-border pb-6">
                  <div>
                    <p className="font-display text-xl text-foreground">Maison Affluency</p>
                    <p className="mt-1 font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      Trade procurement
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Purchase order</p>
                    <p className="font-display text-lg text-foreground">{po.po_number}</p>
                    <p className="mt-1 font-body text-xs text-muted-foreground">Issued {longDate(new Date().toISOString())}</p>
                  </div>
                </header>

                <section className="mt-6 grid gap-6 font-body text-xs sm:grid-cols-3">
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Client</p>
                    <p className="mt-1 text-foreground">{po.client_name || "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Project</p>
                    <p className="mt-1 text-foreground">{po.project_name || "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Quote reference</p>
                    <p className="mt-1 text-foreground">{po.quote_ref}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Cost code</p>
                    <p className="mt-1 text-foreground">{po.cost_code || "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Required by</p>
                    <p className="mt-1 text-foreground">{longDate(po.required_by_date)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.16em] text-muted-foreground">Lead time</p>
                    <p className="mt-1 text-foreground">{po.lead_time || "—"}</p>
                  </div>
                </section>

                <table className="mt-8 w-full border-collapse font-body text-xs">
                  <thead>
                    <tr className="border-y border-border text-left uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="py-2 pr-3 font-normal">Description</th>
                      <th className="py-2 px-3 font-normal">SKU</th>
                      <th className="py-2 px-3 text-right font-normal">Qty</th>
                      <th className="py-2 px-3 text-right font-normal">Unit</th>
                      <th className="py-2 pl-3 text-right font-normal">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border align-top">
                      <td className="py-3 pr-3">
                        <p className="font-display text-sm text-foreground">{po.product_name}</p>
                        <p className="mt-0.5 uppercase tracking-[0.14em] text-muted-foreground">{po.brand_name}</p>
                        {(po.dimensions || po.materials) && (
                          <p className="mt-1.5 text-muted-foreground">
                            {[po.dimensions, po.materials].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{po.sku || "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">{po.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">{money(po.price_cents, currency)}</td>
                      <td className="py-3 pl-3 text-right tabular-nums text-foreground">{money(lineTotal, currency)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="py-3 pr-3 text-right uppercase tracking-[0.14em] text-muted-foreground">
                        Order total
                      </td>
                      <td className="py-3 pl-3 text-right font-display text-sm tabular-nums text-foreground">
                        {money(lineTotal, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <section className="mt-8 border-t border-border pt-5 font-body text-[11px] leading-relaxed text-muted-foreground">
                  <p className="uppercase tracking-[0.16em] text-foreground">Terms</p>
                  <p className="mt-2">
                    This purchase order is issued against the referenced trade quote. Supplier confirmation of lead time and
                    ex-works readiness is required within five business days. Goods must be inspected, protected and labelled
                    with the purchase order reference prior to collection. Invoices quoting this reference are settled per the
                    agreed trade payment schedule.
                  </p>
                </section>

                <section className="mt-10 grid gap-10 font-body text-[11px] sm:grid-cols-2">
                  <div>
                    <div className="h-10 border-b border-border" />
                    <p className="mt-2 uppercase tracking-[0.16em] text-muted-foreground">Approved by · Maison Affluency</p>
                  </div>
                  <div>
                    <div className="h-10 border-b border-border" />
                    <p className="mt-2 uppercase tracking-[0.16em] text-muted-foreground">Supplier acknowledgement · Date</p>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
