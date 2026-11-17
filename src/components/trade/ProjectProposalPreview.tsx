import { downloadDocumentPdf } from "@/lib/appPdfDownload";
import { useEffect, useState } from "react";
import { ProposalPresentationSettings, type ProposalPresentation } from "./ProposalPresentationSettings";
import residencePlan from "@/assets/cipriani-residence-04.asset.json";
import residenceRender from "@/assets/cipriani-residence-living-render.asset.json";
import { ciprianiResidencePreset } from "@/lib/proposalPresentation";
import { FileText, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyIn } from "@/lib/displayMoney";
import { StudioBrand, type StudioBranding } from "@/components/trade/StudioBrand";
import { tradePriceCents, clientUnitCents } from "@/lib/tradePricing";
import { formatPdfMoney } from "@/lib/pdfFormatting";
import { proposalDimensionRows, proposalLeadTime, proposalSwatchColor, proposalSpecifications, type ProposalSpecificationSource } from "@/lib/proposalSpecifications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProposalPreviewItem = ProposalSpecificationSource & {
  product_id: string;
  name: string;
  designer: string;
  image_url: string | null;
  sku: string | null;
  quantity: number;
  rrp_cents: number | null;
  lead_time?: string | null;
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
  roomLabel?: string;
  budget?: { allocated: number; target: number | null; unpriced: number };
  pdfLocale?: string;
  heroImage?: string | null;
  floorPlanImage?: string | null;
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
  roomLabel = "Room type not set",
  budget,
  pdfLocale,
  heroImage = null,
  floorPlanImage = null,
}: ProjectProposalPreviewProps) {
  const preset = ciprianiResidencePreset(projectName);
  const [presentation, setPresentation] = useState<ProposalPresentation>({ clientName: clientName || "", residenceName: preset?.residenceName || "", packageName: "", roomLabel: roomLabel === "Room type not set" ? preset?.roomLabel || roomLabel : roomLabel, targetCents: budget?.target ?? null, heroImage: heroImage || (preset ? residenceRender.url : null), floorPlanImage: floorPlanImage || (preset ? residencePlan.url : null), roomImage: preset ? residenceRender.url : null, highlight: preset?.highlight || null });
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { setPresentation(previous => ({ ...previous, heroImage: previous.heroImage || heroImage, floorPlanImage: previous.floorPlanImage || floorPlanImage })); }, [heroImage, floorPlanImage]);
  useEffect(() => { setPresentation(previous => ({ ...previous, roomLabel: roomLabel === "Room type not set" ? ciprianiResidencePreset(projectName)?.roomLabel || roomLabel : roomLabel, targetCents: budget?.target ?? null })); }, [roomLabel, budget?.target, projectName]);
  const money = makeMoney(currency);
  const tradeTotal = items.reduce((sum, item) => sum + (tradePriceCents(item.rrp_cents, tradeDiscount) || 0) * item.quantity, 0);
  const clientTotal = items.reduce((sum, item) => sum + (clientUnitCents(item.rrp_cents, tradeDiscount, markupMultiplier) || 0) * item.quantity, 0);

  const triggerPrint = async () => {
    const sheet = document.querySelector<HTMLElement>(".proposal-print-sheet");
    if (!sheet) return;
    setDownloading(true);
    const snapshot = sheet.cloneNode(true) as HTMLElement;
    const images = Array.from(sheet.querySelectorAll<HTMLImageElement>("img"));
    const copies = Array.from(snapshot.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(images.map(async (image, index) => {
      const copy = copies[index];
      if (!copy) return;
      try {
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(image, 0, 0);
        copy.src = canvas.toDataURL("image/png");
        copy.removeAttribute("crossorigin");
      } catch { /* Preserve the recorded source if an image is unavailable. */ }
    }));
    try { await downloadDocumentPdf({ element: snapshot, filename: `${projectName} Proposal.pdf`, pageSelector: "[data-proposal-page]" }); } finally { setDownloading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        aria-describedby="proposal-preview-description"
        className="proposal-preview-shell fixed inset-0 left-0 top-0 z-[11000] block h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto border-0 bg-foreground/40 p-0 backdrop-blur-sm print:!h-auto print:!w-[210mm] print:!overflow-visible print:!bg-card print:!backdrop-blur-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">White-label project proposal preview</DialogTitle>
        <DialogDescription id="proposal-preview-description" className="sr-only">
          Preview the current project proposal before downloading the PDF.
        </DialogDescription>

        <div className="proposal-preview-controls fixed right-5 top-5 z-[11002] flex flex-wrap justify-end gap-2 md:right-8 md:top-8">
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
            disabled={downloading}
            className="h-9 rounded-none bg-card/95 px-3 font-body text-[10px] uppercase tracking-[0.15em] text-card-foreground backdrop-blur-sm hover:bg-card"
          >
            <Download className="mr-2 h-3.5 w-3.5" /> [ Download PDF ]
          </Button>
        </div>

        <div className="px-4 pb-12 pt-24">
          <ProposalPresentationSettings value={presentation} onChange={setPresentation} defaultHighlight={presentation.floorPlanImage === residencePlan.url ? preset?.highlight ?? null : null} />
          <main className="proposal-print-sheet luxury-proposal mx-auto w-[min(794px,100%)]">
            <section data-proposal-page className="proposal-page proposal-cover">
              {presentation.heroImage && <img className="proposal-cover-image" src={presentation.heroImage} alt="Cipriani Residences Miami" crossOrigin="anonymous" />}
              <div className="proposal-cover-shade" />
              <div className="proposal-cover-content">
                <p className="proposal-eyebrow">Private client presentation</p>
                <div><p className="proposal-eyebrow">{projectName}</p><h1>{/cipriani/i.test(projectName) ? <>Cipriani<br />Residences Miami</> : projectName}</h1><p className="proposal-cover-subtitle">A considered collection for {presentation.roomLabel === "Room type not set" ? "your residence" : presentation.roomLabel.toLowerCase()}</p></div>
                <div className="proposal-cover-meta"><div><span>Prepared for</span><p>{presentation.clientName || "Private Client"}</p></div><div><span>Residence</span><p>{presentation.residenceName || "Residence to be confirmed"}</p></div><div><span>Collection</span><p>{presentation.packageName || "Bespoke collection"}</p></div></div>
              </div>
            </section>
            <section data-proposal-page className="proposal-page proposal-spatial">
              <ProposalRunningHeader studio={studio} projectName={projectName} roomLabel={presentation.roomLabel} />
              <p className="proposal-eyebrow">01 / Spatial context</p><h2>The residence, considered.</h2>
              <div className="proposal-spatial-grid">
                <figure><div className="proposal-plan-frame">{presentation.floorPlanImage ? <><img src={presentation.floorPlanImage} alt="Selected apartment floor plan" crossOrigin="anonymous" />{presentation.highlight && <div className="proposal-room-highlight" style={{ left: `${Math.max(0, Math.min(100 - presentation.highlight.width, presentation.highlight.x - presentation.highlight.width / 2))}%`, top: `${Math.max(0, Math.min(100 - presentation.highlight.height, presentation.highlight.y - presentation.highlight.height / 2))}%`, width: `${presentation.highlight.width}%`, height: `${presentation.highlight.height}%` }} />}</> : <p>Apartment floor plan awaiting selection</p>}</div><figcaption>{presentation.residenceName || "Residence plan"} · {presentation.roomLabel}</figcaption></figure>
                <figure><div className="proposal-vignette-frame">{presentation.roomImage ? <img src={presentation.roomImage} crossOrigin="anonymous" alt="Rendered 3D room vignette" /> : <p>Room rendering awaiting selection</p>}</div><figcaption>{presentation.roomLabel} / {presentation.roomImage === residenceRender.url ? "Cipriani residence rendering" : "Selected composition"}</figcaption></figure>
              </div>
              <section className="proposal-budget" aria-label="Executive Budget Summary">
                <p className="proposal-eyebrow">Executive Budget Summary</p>
                <div className="proposal-budget-grid"><div><span>Total Package</span><strong>{items.some(item => (item.rrp_cents ?? 0) > 0) ? formatPdfMoney(isClientMode ? clientTotal : tradeTotal, currency, pdfLocale) : "Price upon Request"}</strong>{items.some(item => !item.rrp_cents) && <small>Partial estimate · unpriced pieces</small>}</div><div><span>Target Allocation</span><strong>{formatPdfMoney(presentation.targetCents, currency, pdfLocale, "Not set")}</strong></div><div><span>Lead Time Estimate</span><strong>{proposalLeadTime(items.map(item => item.lead_time))}</strong></div><div><span>Selected Collection</span><strong>{String(items.reduce((total, item) => total + item.quantity, 0)).padStart(2, "0")} pieces</strong></div></div>
              </section>
              <p className="proposal-spatial-note">{location || "Cipriani Residences Miami"} · {presentation.packageName || "Bespoke collection"}</p>
              <ProposalPageFooter number={2} total={2 + Math.ceil(items.length / 3)} />
            </section>
            {Array.from({ length: Math.ceil(items.length / 3) }, (_, page) => <section data-proposal-page key={page} className="proposal-page proposal-schedule">
              <ProposalRunningHeader studio={studio} projectName={projectName} roomLabel={presentation.roomLabel} />
              <div className="proposal-schedule-heading"><div><p className="proposal-eyebrow">02 / Curated schedule</p><h2>Architectural Objects</h2></div><span>{String(items.length).padStart(2, "0")} selections</span></div>
              {items.slice(page * 3, page * 3 + 3).map((item, offset) => {
                const dimensions = proposalDimensionRows(item);
                const specifications = proposalSpecifications(item);
                const price = (isClientMode ? clientUnitCents(item.rrp_cents, tradeDiscount, markupMultiplier) : tradePriceCents(item.rrp_cents, tradeDiscount));
                return <article key={`${item.product_id}:${offset}`} className="proposal-line-item proposal-schedule-row">
                  <div className="proposal-product-picture"><img src={item.image_url || undefined} alt={item.name} />{!item.image_url && <FileText className="size-5" />}</div>
                  <div className="proposal-product-detail"><p className="proposal-eyebrow">{String(page * 3 + offset + 1).padStart(2, "0")} / {isClientMode ? "Curated Collection" : item.designer}{item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}</p><h3>{item.name}</h3>
                    <dl data-proposal-item-specs className="proposal-dimensions"><dt>W × D × H</dt><dd>{dimensions.metric}{dimensions.imperial && <span>{dimensions.imperial}</span>}</dd></dl>
                    {item.finish_swatches?.length ? <div data-proposal-finish-swatches className="proposal-swatches">{item.finish_swatches.map(swatch => <figure key={swatch.id}><ProposalSwatch image={swatch.image_url} color={swatch.color} name={swatch.name} /><figcaption><span>{swatch.axis}</span><p>{swatch.name}</p></figcaption></figure>)}</div> : <p className="proposal-finish-prose">{specifications.finishes !== "On request" ? specifications.finishes : specifications.materials}</p>}
                    <div data-trade-sensitive={!isClientMode ? "" : undefined} className="proposal-price"><span>{isClientMode ? "Client Price" : "Trade / MSRP"}</span><strong>{price != null && price > 0 ? money(price * item.quantity) : "Price upon Request"}</strong></div>
                  </div>
                </article>;
              })}
              <ProposalPageFooter number={page + 3} total={2 + Math.ceil(items.length / 3)} />
            </section>)}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function ProposalRunningHeader({ studio, projectName, roomLabel }: { studio: StudioBranding | null; projectName: string; roomLabel: string }) {
  return <header data-proposal-page-header className="proposal-running-header"><StudioBrand studio={studio} /><div><p>{projectName}</p><span>{roomLabel}</span></div></header>;
}
function ProposalPageFooter({ number, total }: { number: number; total: number }) {
  return <footer className="proposal-page-footer"><span>Private client document</span><span>{String(number).padStart(2, "0")} / {String(total).padStart(2, "0")}</span></footer>;
}
function ProposalSwatch({ image, color, name }: { image: string | null; color?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const hex = proposalSwatchColor(color);
  return <div className="proposal-swatch" style={hex ? { backgroundColor: hex } : undefined}>{image && !failed ? <img src={image} crossOrigin="anonymous" alt={name} onError={() => setFailed(true)} /> : !hex ? <FileText className="size-3" aria-label="Sample image unavailable" /> : null}</div>;
}
