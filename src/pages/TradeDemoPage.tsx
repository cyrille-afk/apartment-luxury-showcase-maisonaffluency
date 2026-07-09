import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Lock, Download, Sparkles, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { AIConcierge } from "@/components/trade/AIConcierge";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { toast } from "sonner";
import {
  DEMO_CITY,
  DEMO_CLIENT_NAME,
  DEMO_PROJECT_NAME,
  DEMO_CURRENCY,
  DEMO_TRADE_DISCOUNT_PCT,
  DEMO_FREE_TEXT,
  DEMO_PASTED_BRIEF,
  DEMO_PIECES,
  DEMO_STEP_META,
  fmtEUR,
  verifyDemoPricesLive,
  type DemoPiece,
  type DemoSteps,
} from "@/lib/demoSandbox";

const PublicConciergeMount: React.FC = () => <AIConcierge surface="public" />;

// Utility: open concierge panel and inject a message (with optional autoSend).
function dispatchConcierge(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("concierge:stage", { detail }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Narration card (bottom-right)
// ─────────────────────────────────────────────────────────────────────────────
const NarrationCard: React.FC<{
  step: DemoSteps;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  canPrev: boolean;
  isLast: boolean;
  actionLabel?: string;
  onAction?: () => void;
  actionDone?: boolean;
}> = ({ step, onNext, onPrev, onExit, canPrev, isLast, actionLabel, onAction, actionDone }) => {
  const meta = DEMO_STEP_META[step];
  return (
    <motion.aside
      key={step}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-6 left-6 z-[10001] w-[380px] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-background/95 backdrop-blur-md shadow-2xl"
    >
      <div className="flex items-start justify-between p-5 pb-3 border-b border-border/50">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--gold))] mb-1">
            Guided demo · {step}/8
          </p>
          <h3 className="font-display text-lg text-foreground leading-tight">
            {meta.title.replace(/^\d+\s·\s/, "")}
          </h3>
        </div>
        <button
          onClick={onExit}
          className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1"
          aria-label="Exit demo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 pt-3">
        <p className="font-body text-sm text-muted-foreground leading-relaxed">{meta.body}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDone}
            className={`mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-body text-[11px] uppercase tracking-[0.2em] transition-all ${
              actionDone
                ? "bg-muted text-muted-foreground cursor-default"
                : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {actionDone ? <><Check className="w-3.5 h-3.5" /> Done</> : actionLabel}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between p-3 border-t border-border/50 bg-muted/20 rounded-b-md">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <span
              key={n}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                n === step ? "bg-foreground" : n < step ? "bg-foreground/40" : "bg-border"
              }`}
            />
          ))}
        </div>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-foreground hover:opacity-70 transition-opacity"
        >
          {isLast ? "Finish" : "Next"} <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </motion.aside>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Step canvases
// ─────────────────────────────────────────────────────────────────────────────

const StepConciergeCanvas: React.FC<{ step: 1 | 2 | 3 }> = ({ step }) => {
  return (
    <div className="max-w-3xl mx-auto px-6">
      <div className="rounded-md border border-border bg-card/40 p-8 md:p-10 text-center">
        <Sparkles className="w-8 h-8 mx-auto text-[hsl(var(--gold))] mb-4" />
        <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">
          The AI Concierge is listening
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          {step === 1 &&
            `Watch the panel open on the right. Every recommendation the Concierge returns will be tuned to ${DEMO_CITY}.`}
          {step === 2 &&
            `A short intent-line is being sent — the Concierge reads "GCB living and dining room" and pulls the right context.`}
          {step === 3 &&
            `The full architectural brief is being pasted. The Concierge will respond with a curated tearsheet grounded strictly in the catalog.`}
        </p>
        <button
          type="button"
          onClick={() => {
            const btn = document.querySelector<HTMLButtonElement>('[aria-label="Open AI Concierge"]');
            btn?.click();
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.2em] hover:opacity-90 transition-opacity"
        >
          Open the Concierge Panel
        </button>
      </div>
    </div>
  );
};

const FinishSelector: React.FC<{
  label: string;
  value: string;
  options: string[];
  locked: boolean;
  onChange: (v: string) => void;
}> = ({ label, value, options, locked, onChange }) => (
  <div>
    <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
      {label}
    </p>
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={locked}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full font-body text-[11px] border transition-all ${
            value === opt
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-foreground border-border hover:border-foreground/60"
          } ${locked ? "cursor-default opacity-70" : ""}`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const Product3DCard: React.FC<{
  piece: DemoPiece;
  selection: { base: string; top: string };
  locked: boolean;
  onChangeFinish: (kind: "base" | "top", v: string) => void;
  onToggleLock: () => void;
}> = ({ piece, selection, locked, onChangeFinish, onToggleLock }) => {
  const [rot, setRot] = useState(0);
  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => setRot((r) => (r + 1) % 360), 50);
    return () => clearInterval(t);
  }, [locked]);
  return (
    <div className="rounded-md border border-border bg-card/40 overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-muted/40 to-muted/10 overflow-hidden">
        <motion.img
          src={piece.imageUrl}
          alt={piece.title}
          animate={{ rotateY: rot / 6, scale: locked ? 1 : 1.02 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transformStyle: "preserve-3d" }}
        />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          3D · Live
        </div>
        {locked && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[hsl(var(--gold))] font-body text-[9px] uppercase tracking-[0.2em] text-white flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Locked
          </div>
        )}
      </div>
      <div className="p-4 space-y-3 flex-1">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {piece.brand} · {piece.designer}
          </p>
          <h3 className="font-display text-base text-foreground mt-0.5">{piece.title}</h3>
          <p className="font-body text-[11px] text-muted-foreground mt-1">{piece.dimensions}</p>
        </div>
        <FinishSelector
          label="Base"
          value={selection.base}
          options={piece.finishOptions.base}
          locked={locked}
          onChange={(v) => onChangeFinish("base", v)}
        />
        <FinishSelector
          label="Top / Upholstery"
          value={selection.top}
          options={piece.finishOptions.top}
          locked={locked}
          onChange={(v) => onChangeFinish("top", v)}
        />
        <button
          type="button"
          onClick={onToggleLock}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-body text-[10px] uppercase tracking-[0.2em] transition-all ${
            locked
              ? "bg-muted text-muted-foreground"
              : "bg-foreground text-background hover:opacity-90"
          }`}
        >
          <Lock className="w-3 h-3" />
          {locked ? "Finish locked" : "Lock finish"}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const TradeDemoPage: React.FC = () => {
  const [step, setStep] = useState<DemoSteps>(1);
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(
      DEMO_PIECES.map((p) => [p.pickId, { base: p.finishes.base, top: p.finishes.top }])
    ) as Record<string, { base: string; top: string }>
  );
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [addedToProject, setAddedToProject] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);

  const allLocked = DEMO_PIECES.every((p) => locked[p.pickId]);
  const totalRRP = DEMO_PIECES.reduce((s, p) => s + p.rrpCents, 0);
  const totalTrade = DEMO_PIECES.reduce((s, p) => s + p.tradePriceCents, 0);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // One-shot live pricing cross-check against the DB. Runs lazily
  // so it never blocks initial render; warns via console if any
  // demo seed drifts from the live catalogue price.
  useEffect(() => {
    void verifyDemoPricesLive();
  }, []);

  // Concierge opens on demand (via step 1's CTA or the auto-send on step 2/3).
  // We do NOT auto-open on mount so the narration card stays visible.

  const sendIntent = useCallback(() => {
    dispatchConcierge({
      openPanel: true,
      prefill: `${DEMO_FREE_TEXT} (in ${DEMO_CITY}).`,
      autoSend: true,
      displayMessage: DEMO_FREE_TEXT,
    });
    toast.success("Intent sent to Concierge");
  }, []);

  const sendBrief = useCallback(() => {
    dispatchConcierge({
      openPanel: true,
      prefill: `${DEMO_PASTED_BRIEF} Project location: ${DEMO_CITY}. Client: ${DEMO_CLIENT_NAME}. Project: ${DEMO_PROJECT_NAME}.`,
      autoSend: true,
      displayMessage: DEMO_PASTED_BRIEF,
    });
    toast.success("Brief sent to Concierge");
  }, []);

  const lockAll = useCallback(() => {
    setLocked(Object.fromEntries(DEMO_PIECES.map((p) => [p.pickId, true])));
    toast.success("All finishes locked");
  }, []);

  const addToProject = useCallback(() => {
    setAddedToProject(true);
    toast.success(`Added to "${DEMO_PROJECT_NAME}"`);
  }, []);

  const downloadPdf = useCallback(async () => {
    setPdfDownloading(true);
    try {
      const now = new Date();
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 30);
      const lines = DEMO_PIECES.map((p) => {
        const sel = selections[p.pickId];
        return {
          productName: p.title,
          brandName: `${p.brand} · ${p.designer}`,
          dimensions: p.dimensions,
          materials: null,
          edition: null,
          variantLabel: `${sel.base} · ${sel.top}`,
          fabricLabel: `Fabric: ${sel.top}`,
          woodFinishLabel: `Wood finish: ${sel.base}`,
          leadTime: p.leadTime,
          notes: null,
          quantity: 1,
          unitPriceCents: p.tradePriceCents,
          lineTotalCents: p.tradePriceCents,
          imageUrl: p.imageUrl,
        };
      });
      await downloadQuotePdf({
        quoteNumber: "DEMO-2026-001",
        status: "priced",
        statusLabel: "Priced",
        createdAt: now,
        expiryAt: expiry,
        clientName: DEMO_CLIENT_NAME,
        clientCompany: DEMO_CLIENT_NAME,
        projectName: DEMO_PROJECT_NAME,
        currency: DEMO_CURRENCY,
        lines,
        subtotalCents: totalTrade,
        tradeDiscountPct: DEMO_TRADE_DISCOUNT_PCT,
        tradeDiscountApplied: true,
        tierLabel: "Silver",
        gstEnabled: false,
        gstRate: 0,
      });
      setPdfDone(true);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfDownloading(false);
    }
  }, [selections, totalTrade]);

  const goNext = () => setStep((s) => (s < 8 ? ((s + 1) as DemoSteps) : s));
  const goPrev = () => setStep((s) => (s > 1 ? ((s - 1) as DemoSteps) : s));
  const exit = () => (window.location.href = "/trade-program");

  const actionForStep = useMemo(() => {
    switch (step) {
      case 2:
        return { label: DEMO_STEP_META[2].cta, run: sendIntent };
      case 3:
        return { label: DEMO_STEP_META[3].cta, run: sendBrief };
      case 4:
        return { label: DEMO_STEP_META[4].cta, run: lockAll, done: allLocked };
      case 5:
        return { label: DEMO_STEP_META[5].cta, run: addToProject, done: addedToProject };
      case 8:
        return { label: DEMO_STEP_META[8].cta, run: downloadPdf, done: pdfDone };
      default:
        return undefined;
    }
  }, [step, sendIntent, sendBrief, lockAll, allLocked, addToProject, addedToProject, downloadPdf, pdfDone]);

  return (
    <>
      <Helmet>
        <title>AI Concierge Demo · Maison Affluency Trade</title>
        <meta name="description" content="See the full Maison Affluency trade workflow: AI Concierge brief, 3D configuration, tearsheet, quote, and PDF — in eight steps." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="pt-24 pb-40">
          {/* Hero band */}
          <section className="max-w-5xl mx-auto px-6 md:px-8 text-center mb-10">
            <p className="font-body text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--gold))] mb-4">
              Guided Demo
            </p>
            <h1 className="font-display text-3xl md:text-5xl leading-[1.05] text-foreground">
              From brief to signed quote — in eight steps.
            </h1>
            <p className="font-body italic text-sm md:text-base text-muted-foreground mt-4 max-w-2xl mx-auto">
              A live walkthrough of the trade workflow: AI Concierge, 3D configuration,
              tearsheet, priced quote, and PDF — with real Man of Parts pieces.
            </p>
          </section>

          {/* Progress rail */}
          <section className="max-w-5xl mx-auto px-6 md:px-8 mb-10">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setStep(n as DemoSteps)}
                  className={`h-1 rounded-full transition-colors ${
                    n === step
                      ? "bg-foreground"
                      : n < step
                      ? "bg-foreground/40"
                      : "bg-border hover:bg-border/80"
                  }`}
                  aria-label={`Jump to step ${n}`}
                />
              ))}
            </div>
          </section>

          {/* Step canvas */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              {(step === 1 || step === 2 || step === 3) && (
                <StepConciergeCanvas step={step} />
              )}

              {step === 4 && (
                <section className="max-w-6xl mx-auto px-6 md:px-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {DEMO_PIECES.map((p) => (
                      <Product3DCard
                        key={p.pickId}
                        piece={p}
                        selection={selections[p.pickId]}
                        locked={!!locked[p.pickId]}
                        onChangeFinish={(kind, v) =>
                          setSelections((s) => ({
                            ...s,
                            [p.pickId]: { ...s[p.pickId], [kind]: v },
                          }))
                        }
                        onToggleLock={() =>
                          setLocked((l) => ({ ...l, [p.pickId]: !l[p.pickId] }))
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {step === 5 && (
                <section className="max-w-3xl mx-auto px-6">
                  <div className="rounded-md border border-border bg-card/40 p-8">
                    <p className="font-body text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--gold))] mb-4">
                      Add to project
                    </p>
                    <h2 className="font-display text-2xl text-foreground mb-6">
                      Confirm the destination
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 border border-border rounded-sm">
                        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                          Client
                        </p>
                        <p className="font-display text-base text-foreground">
                          {DEMO_CLIENT_NAME}
                        </p>
                      </div>
                      <div className="p-4 border border-border rounded-sm">
                        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                          Project
                        </p>
                        <p className="font-display text-base text-foreground">
                          {DEMO_PROJECT_NAME}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {DEMO_PIECES.map((p) => {
                        const sel = selections[p.pickId];
                        return (
                          <div
                            key={p.pickId}
                            className="flex items-center justify-between p-3 border border-border/60 rounded-sm bg-background/60"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={p.imageUrl}
                                alt={p.title}
                                className="w-12 h-12 object-cover rounded-sm"
                              />
                              <div>
                                <p className="font-display text-sm text-foreground">
                                  {p.title}
                                </p>
                                <p className="font-body text-[11px] text-muted-foreground">
                                  {sel.base} · {sel.top}
                                </p>
                              </div>
                            </div>
                            {addedToProject && (
                              <Check className="w-4 h-4 text-[hsl(var(--gold))]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {addedToProject && (
                      <p className="mt-6 font-body italic text-sm text-muted-foreground text-center">
                        3 pieces added to {DEMO_PROJECT_NAME}.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {step === 6 && (
                <section className="max-w-5xl mx-auto px-6">
                  <div className="rounded-md border border-border bg-card/40 p-8">
                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-border">
                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--gold))] mb-2">
                          Tearsheet
                        </p>
                        <h2 className="font-display text-2xl text-foreground">
                          {DEMO_PROJECT_NAME}
                        </h2>
                        <p className="font-body text-sm text-muted-foreground mt-1">
                          {DEMO_CLIENT_NAME}
                        </p>
                      </div>
                      <p className="font-body text-[11px] text-muted-foreground">
                        {new Date().toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="space-y-6">
                      {DEMO_PIECES.map((p) => {
                        const sel = selections[p.pickId];
                        return (
                          <div key={p.pickId} className="grid grid-cols-[120px_1fr] gap-5">
                            <img
                              src={p.imageUrl}
                              alt={p.title}
                              className="w-full aspect-square object-cover rounded-sm"
                            />
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                              <div className="col-span-2">
                                <p className="font-display text-base text-foreground">
                                  {p.title}
                                </p>
                                <p className="font-body text-[11px] text-muted-foreground">
                                  {p.brand} · {p.designer}
                                </p>
                              </div>
                              <div>
                                <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  Dimensions
                                </p>
                                <p className="font-body text-sm text-foreground">
                                  {p.dimensions}
                                </p>
                              </div>
                              <div>
                                <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  Lead time
                                </p>
                                <p className="font-body text-sm text-foreground">
                                  {p.leadTime}
                                </p>
                              </div>
                              <div>
                                <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  Finish · Base
                                </p>
                                <p className="font-body text-sm text-foreground">{sel.base}</p>
                              </div>
                              <div>
                                <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  Finish · Top
                                </p>
                                <p className="font-body text-sm text-foreground">{sel.top}</p>
                              </div>
                              <div>
                                <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  RRP
                                </p>
                                <p className="font-body text-sm text-foreground">
                                  {fmtEUR(p.rrpCents)}
                                </p>
                              </div>
                              <div>
                                <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  Trade price
                                </p>
                                <p className="font-body text-sm text-[hsl(var(--gold))]">
                                  {fmtEUR(p.tradePriceCents)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {step === 7 && (
                <section className="max-w-4xl mx-auto px-6">
                  <div className="rounded-md border border-border bg-card/40 p-8">
                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-border">
                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--gold))] mb-2">
                          Quote · DEMO-2026-001
                        </p>
                        <h2 className="font-display text-2xl text-foreground">
                          {DEMO_CLIENT_NAME}
                        </h2>
                        <p className="font-body text-sm text-muted-foreground mt-1">
                          Project: {DEMO_PROJECT_NAME}
                        </p>
                      </div>
                      <p className="font-body text-[11px] text-muted-foreground">
                        {DEMO_CURRENCY}
                      </p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="text-left py-2 font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">
                            Piece
                          </th>
                          <th className="text-left py-2 font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">
                            Selected finish
                          </th>
                          <th className="text-right py-2 font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">
                            RRP
                          </th>
                          <th className="text-right py-2 font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">
                            Trade
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEMO_PIECES.map((p) => {
                          const sel = selections[p.pickId];
                          return (
                            <tr key={p.pickId} className="border-b border-border/40">
                              <td className="py-3">
                                <p className="font-display text-sm text-foreground">
                                  {p.title}
                                </p>
                                <p className="font-body text-[11px] text-muted-foreground">
                                  {p.brand} · {p.dimensions}
                                </p>
                              </td>
                              <td className="py-3 font-body text-[12px] text-foreground">
                                {sel.base}
                                <br />
                                <span className="text-muted-foreground">{sel.top}</span>
                              </td>
                              <td className="py-3 text-right font-body text-sm text-muted-foreground line-through">
                                {fmtEUR(p.rrpCents)}
                              </td>
                              <td className="py-3 text-right font-body text-sm text-[hsl(var(--gold))]">
                                {fmtEUR(p.tradePriceCents)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} className="pt-4 font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Subtotal (RRP)
                          </td>
                          <td colSpan={2} className="pt-4 text-right font-body text-sm text-muted-foreground line-through">
                            {fmtEUR(totalRRP)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={2} className="pt-2 font-body text-[11px] uppercase tracking-[0.2em] text-foreground">
                            Trade total (Silver · -8%)
                          </td>
                          <td colSpan={2} className="pt-2 text-right font-display text-lg text-foreground">
                            {fmtEUR(totalTrade)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              )}

              {step === 8 && (
                <section className="max-w-3xl mx-auto px-6 text-center">
                  <div className="rounded-md border border-border bg-card/40 p-10">
                    <Download className="w-10 h-10 mx-auto text-[hsl(var(--gold))] mb-4" />
                    <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                      Your quote is ready
                    </h2>
                    <div className="font-body text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                      Client{" "}
                      <span className="text-foreground">{DEMO_CLIENT_NAME}</span> · Project{" "}
                      <span className="text-foreground">{DEMO_PROJECT_NAME}</span>
                    </div>
                    <p className="mt-2 font-body text-sm text-muted-foreground">
                      Total {fmtEUR(totalTrade)} · 3 pieces
                    </p>
                    <button
                      type="button"
                      onClick={downloadPdf}
                      disabled={pdfDownloading}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-3 font-body text-[11px] uppercase tracking-[0.2em] hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {pdfDownloading
                        ? "Generating…"
                        : pdfDone
                        ? "Download again"
                        : "Download PDF"}
                    </button>
                    {pdfDone && (
                      <p className="mt-6 font-body italic text-sm text-muted-foreground">
                        Client & project name are stamped on the cover page.
                      </p>
                    )}
                    <p className="mt-8 font-body text-[11px] text-muted-foreground">
                      Ready to run this on your own projects?{" "}
                      <Link
                        to="/trade-program"
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        Apply for trade access
                      </Link>
                      .
                    </p>
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <Footer />

        {/* Concierge is mounted globally so steps 1-3 can drive it. */}
        <PublicConciergeMount />

        {/* Narration */}
        <AnimatePresence mode="wait">
          <NarrationCard
            step={step}
            onNext={goNext}
            onPrev={goPrev}
            onExit={exit}
            canPrev={step > 1}
            isLast={step === 8}
            actionLabel={actionForStep?.label}
            onAction={actionForStep?.run}
            actionDone={actionForStep?.done}
          />
        </AnimatePresence>
      </div>
    </>
  );
};

export default TradeDemoPage;
