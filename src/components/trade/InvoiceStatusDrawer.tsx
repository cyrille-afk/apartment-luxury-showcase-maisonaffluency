import { useEffect, useState } from "react";
import { Check, Lock, Printer, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/bodyScrollLock";

interface Milestone {
  step: string;
  label: string;
  detail: string;
  state: "completed" | "current" | "locked";
}

interface FulfillmentItem {
  name: string;
  phase: string;
  leadTime: string;
}

const MILESTONES: Milestone[] = [
  {
    step: "01",
    label: "DEPOSIT CLEARANCE",
    detail: "Completed 14 Sept 2026",
    state: "completed",
  },
  {
    step: "02",
    label: "PRODUCTION ACTIVE (MAN OF PARTS ATELIER)",
    detail: "S$24,557.60 Deposit Disbursed",
    state: "current",
  },
  {
    step: "03",
    label: "QUALITY CONTROL INHOUSE INSPECTION",
    detail: "Est. Nov 2026",
    state: "locked",
  },
  {
    step: "04",
    label: "CRATING & FREIGHT RELEASE",
    detail: "Pending 40% Balance S$16,371.73 Settlement",
    state: "locked",
  },
];

const FULFILLMENT_ITEMS: FulfillmentItem[] = [
  {
    name: "Frenchmen Street Lounge Chair",
    phase: "Finish Upholstery Phase",
    leadTime: "10-16 Weeks",
  },
  {
    name: "Madison Avenue Side Table",
    phase: "Metalwork Patina Phase",
    leadTime: "10-16 Weeks",
  },
  {
    name: "Praia da Granja Coffee Table",
    phase: "Wood Selection Phase",
    leadTime: "10-16 Weeks",
  },
  {
    name: "Rua Leblon Sofa & Sandy Cove Sofa",
    phase: "Frame Assemblies Phase",
    leadTime: "10-16 Weeks",
  },
];

export interface InvoiceStatusDrawerProps {
  quoteId: string;
  open: boolean;
  onClose: () => void;
  projectName?: string;
}

export function InvoiceStatusDrawer({
  quoteId,
  open,
  onClose,
  projectName = "Singapore GCB workflow",
}: InvoiceStatusDrawerProps) {
  const [visible, setVisible] = useState(false);

  // Animate in on mount, animate out before calling onClose.
  useEffect(() => {
    if (open) {
      const timer = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(timer);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
    return () => {
      unlockBodyScroll();
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 480);
  };

  const displayQuoteNumber = quoteId
    ? `QU-${quoteId.slice(0, 6).toUpperCase()}`
    : "QU-200169";

  return (
    <div className="fixed inset-0 z-40 isolate" aria-modal="true" role="dialog">
      {/* Backdrop mask */}
      <button
        type="button"
        aria-label="Close record"
        onClick={handleClose}
        className={cn(
          "absolute inset-0 bg-black/5 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "absolute top-0 right-0 h-screen w-full md:w-[45%] md:min-w-[420px] md:max-w-[720px]",
          "bg-background border-l border-border",
          "flex flex-col",
          "transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-6 px-8 pt-8 pb-6 border-b border-border">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-light text-foreground leading-tight">
              PROFORMA STATUS // {displayQuoteNumber}
            </h2>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              PROJECT: {projectName.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            [ CLOSE RECORD ]
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10">
          {/* Production timeline */}
          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
              White-Glove Production Timeline
            </h3>
            <div className="relative pl-4 border-l border-border space-y-8">
              {MILESTONES.map((m) => (
                <div key={m.step} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[calc(0.5rem+1px)] top-1.5 h-2 w-2 rounded-full border border-border",
                      m.state === "current"
                        ? "bg-foreground"
                        : m.state === "completed"
                        ? "bg-muted-foreground/40"
                        : "bg-background"
                    )}
                  />
                  <div className="space-y-1">
                    <div
                      className={cn(
                        "flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-mono",
                        m.state === "current"
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground"
                      )}
                    >
                      {m.state === "completed" && (
                        <Check className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      )}
                      {m.state === "locked" && (
                        <Lock className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
                      )}
                      <span>
                        {m.step} // {m.label}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm font-body text-muted-foreground",
                        m.state === "current" && "text-foreground"
                      )}
                    >
                      {m.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Fulfillment matrix */}
          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
              Itemized Fulfillment Matrix
            </h3>
            <div className="space-y-5">
              {FULFILLMENT_ITEMS.map((item) => (
                <div key={item.name} className="space-y-1">
                  <p className="text-sm font-sans text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs font-mono uppercase tracking-[0.1em] text-muted-foreground">
                    {item.phase} [Lead Time: {item.leadTime}]
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer actions */}
        <div className="px-8 py-6 border-t border-border flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground hover:text-muted-foreground transition-colors"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            [ ⎙ DOWNLOAD SIGNED PROFORMA PDF ]
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 cursor-not-allowed"
          >
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            [ 💳 EXECUTE STAGE-2 BALANCE SETTLEMENT ]
          </button>
        </div>
      </div>
    </div>
  );
}
