import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { FileDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpecDrawerItem = {
  product_id: string;
  name: string;
  designer: string;
  image_url: string | null;
  sku: string | null;
  lead_time: string | null;
  dimensions: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  size_variants?: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
};

type Finish = { label: string; swatch: string };

// Curated finish palette — designers select a working finish for the spec record.
const FINISHES: Finish[] = [
  { label: "Natural Oak", swatch: "#C8A97E" },
  { label: "Smoked Eucalyptus", swatch: "#5C4A3A" },
  { label: "Honed Travertine", swatch: "#D8CDBB" },
  { label: "Bouclé Ivory", swatch: "#EFE9DF" },
  { label: "Bronze Patina", swatch: "#7A6248" },
  { label: "COM Fabric", swatch: "#9A9A94" },
  { label: "Custom Finish", swatch: "#1A1A1A" },
];

function cratingLabel(item: SpecDrawerItem) {
  const dims = resolveDimensions(item);
  if (dims) {
    return `${dims.w + 120} × ${dims.d + 120} × ${dims.h + 120} mm (crated)`;
  }
  return item.dimensions ? `${item.dimensions} (uncrated)` : "On request";
}

function dimsLabel(item: SpecDrawerItem) {
  return formatDimensions(resolveDimensions(item)) || DIMENSIONS_PLACEHOLDER;
}

export function ProjectSpecDrawer({
  item,
  onClose,
}: {
  item: SpecDrawerItem | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [finish, setFinish] = useState<string | null>(null);
  const [customDims, setCustomDims] = useState({ w: "", d: "", h: "" });

  // Mount/unmount lifecycle so the exit transition can play.
  useEffect(() => {
    if (item) {
      setMounted(true);
      setFinish(null);
      setCustomDims({ w: "", d: "", h: "" });
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 550);
    return () => window.clearTimeout(t);
  }, [item]);

  // Escape to close + body scroll lock.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, onClose]);

  const specs = useMemo(() => {
    if (!item) return [];
    return [
      { label: "Dimensions", value: dimsLabel(item) },
      { label: "Weight", value: "On request — confirmed at crating" },
      { label: "Crating Dimensions", value: cratingLabel(item) },
      { label: "COM Requirements", value: "14 yards of customer fabric required" },
      { label: "Lead Time", value: item.lead_time || "On request" },
      { label: "SKU", value: item.sku || "—" },
    ];
  }, [item]);

  if (!mounted || !item) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" aria-hidden={!visible}>
      {/* Mask */}
      <button
        aria-label="Close specification"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/10 transition-opacity duration-500",
          visible ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Specification — ${item.name}`}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-background border-l border-border sm:w-[70vw] lg:w-[40vw]",
          "transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-6 border-b border-border px-6 py-6 md:px-10">
          <div className="min-w-0">
            <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Specification // {item.sku || "—"}
            </p>
            <h2 className="mt-2 font-display text-2xl leading-tight text-foreground">
              {item.name}
            </h2>
            <p className="mt-1 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {item.designer}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
          >
            [ Close Specification ]
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          {item.image_url && (
            <div className="mb-8 bg-muted">
              <img
                src={item.image_url}
                alt={`${item.name} by ${item.designer}`}
                className="max-h-64 w-full object-contain"
              />
            </div>
          )}

          {/* Finish variations */}
          <section>
            <p className="font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
              Material &amp; Finish Variations
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {FINISHES.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setFinish(f.label)}
                  aria-pressed={finish === f.label}
                  title={f.label}
                  className="group flex flex-col items-start gap-1.5"
                >
                  <span
                    className={cn(
                      "h-8 w-8 transition-opacity",
                      finish === f.label
                        ? "ring-1 ring-foreground ring-offset-2 ring-offset-background"
                        : "opacity-80 group-hover:opacity-100"
                    )}
                    style={{ backgroundColor: f.swatch }}
                  />
                  <span
                    className={cn(
                      "font-body text-[9px] uppercase tracking-[0.12em]",
                      finish === f.label ? "text-foreground" : "text-muted-foreground/60"
                    )}
                  >
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {finish ? `Selected: ${finish}` : "Select a finish to record against this piece"}
            </p>

            {/* Custom dimensions */}
            <div className="mt-6 border-t border-border pt-5">
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Custom dimensions (mm)
              </p>
              <div className="mt-3 flex items-center gap-2">
                {(["w", "d", "h"] as const).map((axis, i) => (
                  <span key={axis} className="flex items-center gap-2">
                    {i > 0 && <span className="font-body text-[10px] text-muted-foreground/60">×</span>}
                    <input
                      value={customDims[axis]}
                      onChange={(e) =>
                        setCustomDims((c) => ({ ...c, [axis]: e.target.value.replace(/[^0-9]/g, "") }))
                      }
                      placeholder={axis.toUpperCase()}
                      inputMode="numeric"
                      aria-label={`Custom ${axis === "w" ? "width" : axis === "d" ? "depth" : "height"} in millimetres`}
                      className="w-16 border-0 border-b border-border bg-transparent pb-1 font-body text-[11px] tracking-[0.05em] text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
                    />
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Technical specs */}
          <section className="mt-8 border-t border-border pt-6">
            <p className="font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
              Technical Specification
            </p>
            <dl className="mt-4">
              {specs.map((s) => (
                <div
                  key={s.label}
                  className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-border py-3"
                >
                  <dt className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {s.label}
                  </dt>
                  <dd className="font-body text-[11px] tracking-[0.05em] text-foreground">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Footer CTAs */}
        <div className="border-t border-border px-6 py-5 md:px-10 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex flex-col gap-3">
            <Link
              to={`/trade/products/${item.product_id}`}
              className="inline-flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.15em] text-foreground underline underline-offset-4 hover:no-underline"
            >
              <FileDown className="h-3.5 w-3.5" /> Download White-Label Tear Sheet (PDF)
            </Link>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("ma:request-samples", { detail: { productId: item.product_id } }))}
              className="inline-flex items-center gap-2 self-start font-body text-[10px] uppercase tracking-[0.15em] text-foreground underline underline-offset-4 hover:no-underline"
            >
              <Package className="h-3.5 w-3.5" /> Request Material Samples
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
