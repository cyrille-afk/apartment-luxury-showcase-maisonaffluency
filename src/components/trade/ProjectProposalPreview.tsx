import { FileText, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyIn } from "@/lib/displayMoney";
import { StudioBrand, type StudioBranding } from "@/components/trade/StudioBrand";
import { tradePriceCents, clientPriceCents } from "@/lib/tradePricing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProposalPreviewItem = {
  product_id: string;
  name: string;
  designer: string;
  image_url: string | null;
  sku: string | null;
  quantity: number;
  rrp_cents: number | null;
};

interface ProjectProposalPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  clientName: string | null;
  location: string | null;
  items: ProposalPreviewItem[];
  isClientMode: boolean;
  tradeDiscount: number;
  markupMultiplier: number;
  studio: StudioBranding | null;
  /** Member's declared base currency — every figure is rendered in it. */
  currency?: string;
}

function makeMoney(currency: string) {
  return (cents: number | null | undefined) => formatMoneyIn(cents, currency);
}

export function ProjectProposalPreview({
  open,
  onOpenChange,
  projectName,
  clientName,
  location,
  items,
  isClientMode,
  tradeDiscount,
  markupMultiplier,
  studio,
  currency = "USD",
}: ProjectProposalPreviewProps) {
  const money = makeMoney(currency);
  const retailTotal = items.reduce((sum, item) => sum + (item.rrp_cents || 0) * item.quantity, 0);
  const tradeTotal = items.reduce((sum, item) => sum + (tradePriceCents(item.rrp_cents, tradeDiscount) || 0) * item.quantity, 0);
  const clientTotal = items.reduce((sum, item) => sum + (clientPriceCents(tradePriceCents(item.rrp_cents, tradeDiscount), markupMultiplier) || 0) * item.quantity, 0);

  const triggerPrint = () => {
    const sheet = document.querySelector<HTMLElement>(".proposal-print-sheet");
    if (!sheet) return;

    document.querySelector(".proposal-print-document")?.remove();
    const printDocument = sheet.cloneNode(true) as HTMLElement;
    printDocument.classList.remove("proposal-print-sheet");
    printDocument.classList.add("proposal-print-document");
    document.body.appendChild(printDocument);

    const cleanup = () => printDocument.remove();
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        aria-describedby="proposal-preview-description"
        className="proposal-preview-shell fixed inset-0 left-0 top-0 z-[120] block h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto border-0 bg-foreground/40 p-0 backdrop-blur-sm print:!h-auto print:!w-[210mm] print:!overflow-visible print:!bg-card print:!backdrop-blur-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">White-label project proposal preview</DialogTitle>
        <DialogDescription id="proposal-preview-description" className="sr-only">
          Preview the current project proposal before opening the browser print system.
        </DialogDescription>

        <div className="proposal-preview-controls fixed right-5 top-5 z-[122] flex flex-wrap justify-end gap-2 md:right-8 md:top-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-none bg-card/95 px-3 font-body text-[10px] uppercase tracking-[0.15em] text-card-foreground backdrop-blur-sm hover:bg-card"
          >
            <X className="mr-2 h-3.5 w-3.5" /> [ Close Preview ]
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={triggerPrint}
            className="h-9 rounded-none bg-card/95 px-3 font-body text-[10px] uppercase tracking-[0.15em] text-card-foreground backdrop-blur-sm hover:bg-card"
          >
            <Printer className="mr-2 h-3.5 w-3.5" /> [ Trigger Print System ]
          </Button>
        </div>

        <main className="proposal-print-sheet mx-auto my-20 min-h-[1123px] w-[min(794px,calc(100vw-32px))] bg-card px-12 py-14 text-card-foreground shadow-elegant md:px-16 md:py-20">
          <header className="flex min-h-[330px] flex-col justify-between border-b border-card-foreground pb-12">
            <div className="flex items-center justify-between gap-6">
               <StudioBrand studio={studio} />
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Private client document
              </p>
            </div>
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Project Proposal // {projectName}
              </p>
              <h2 className="mt-5 max-w-2xl font-display text-4xl font-normal leading-tight text-card-foreground md:text-5xl">
                {projectName}
              </h2>
              <div className="mt-8 grid grid-cols-2 gap-8 font-body text-[10px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground">
                <p>Prepared for<br /><span className="text-card-foreground">{clientName || "Private Client"}</span></p>
                <p>Project location<br /><span className="text-card-foreground">{location || "To be confirmed"}</span></p>
              </div>
            </div>
          </header>

          <section className="pt-12" aria-label="Proposal items">
            <div className="flex items-end justify-between border-b border-border pb-4">
              <div>
                <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Selected collection</p>
                <p className="mt-2 font-display text-2xl text-card-foreground">Architectural Objects</p>
              </div>
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {String(items.length).padStart(2, "0")} pieces
              </p>
            </div>

            <div>
              {items.map((item, index) => {
                const retail = (item.rrp_cents || 0) * item.quantity;
                 const trade = (tradePriceCents(item.rrp_cents, tradeDiscount) || 0) * item.quantity;
                 const client = (clientPriceCents(tradePriceCents(item.rrp_cents, tradeDiscount), markupMultiplier) || 0) * item.quantity;
                return (
                  <article key={item.product_id} className="proposal-line-item grid grid-cols-[48px_72px_minmax(0,1fr)_auto] items-center gap-x-5 border-b border-border py-6 break-inside-avoid">
                    <span className="pr-3 text-right font-body text-[9px] tracking-[0.15em] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="h-16 w-[72px] bg-background">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                      ) : (
                        <FileText className="m-auto h-full w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-normal leading-snug text-card-foreground">{item.name}</h3>
                      <p className="mt-1 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                         {isClientMode ? "Curated Collection" : item.designer}{!isClientMode && item.sku ? ` · ${item.sku}` : ""}{item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                         {isClientMode ? "Client Price" : "Trade / MSRP"}
                      </p>
                      <p className="mt-1 font-body text-[11px] tracking-[0.05em] text-card-foreground">
                         {isClientMode ? (money(client) || "Price upon Request") : (money(trade) || "Price upon Request")}
                      </p>
                      {!isClientMode && retail > 0 && (
                        <p className="mt-1 font-body text-[9px] tracking-[0.05em] text-muted-foreground line-through">
                          {money(retail)}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <footer className="mt-10 flex items-baseline justify-between border-t border-card-foreground pt-5">
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-card-foreground">
                {isClientMode ? "Total Estimate" : "Total Trade"}
              </p>
              <p className="font-display text-2xl text-card-foreground">
                 {money(isClientMode ? clientTotal : tradeTotal)}
              </p>
            </footer>
          </section>
           <p className="mt-12 border-t border-border pt-4 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{studio?.display_name?.trim() || studio?.name || "Your Studio"} · {projectName}</p>
        </main>
      </DialogContent>
    </Dialog>
  );
}