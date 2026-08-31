import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

/**
 * Public, crawlable specification block + the signed-out "Trade Exclusive"
 * paywall card used on public product pages.
 *
 * Everything rendered here comes from PUBLIC product data only (dimensions,
 * materials, description, images, SKU). Trade-sensitive values (net price,
 * lead time, stock, CAD downloads) never reach this component.
 */

export interface ParsedDimensions {
  width?: number;
  depth?: number;
  height?: number;
  diameter?: number;
  unit: string;
}

const NUM = "(\\d+(?:[.,]\\d+)?)";

/**
 * Parses free-text dimension strings such as
 *   "W 60 × D 55 × H 75 cm", "60 x 55 x 75 cm", "H 75cm, Ø 40cm"
 * into structured numbers for schema.org QuantitativeValue output.
 */
export function parseDimensions(raw?: string | null): ParsedDimensions | null {
  if (!raw) return null;
  const text = String(raw).replace(/,/g, ".").replace(/×/g, "x");
  const unit = /\bin(?:ch(?:es)?)?\b|"/i.test(text) && !/\bcm\b|\bmm\b/i.test(text) ? "INH" : "CMT";

  const grab = (labels: string[]) => {
    for (const l of labels) {
      const m = text.match(new RegExp(`${l}\\s*[:.]?\\s*${NUM}`, "i"));
      if (m) return parseFloat(m[1]);
    }
    return undefined;
  };

  let width = grab(["\\bW(?:idth)?\\b", "\\bL(?:ength)?\\b"]);
  let depth = grab(["\\bD(?:epth)?\\b", "\\bP(?:rof)?\\b"]);
  let height = grab(["\\bH(?:eight)?\\b"]);
  const diameter = grab(["Ø", "\\bdia(?:meter)?\\b"]);

  // Unlabelled triple: "60 x 55 x 75 cm" → W x D x H
  if (width === undefined && depth === undefined && height === undefined) {
    const triple = text.match(new RegExp(`${NUM}\\s*x\\s*${NUM}\\s*x\\s*${NUM}`, "i"));
    if (triple) {
      width = parseFloat(triple[1]);
      depth = parseFloat(triple[2]);
      height = parseFloat(triple[3]);
    }
  }

  if (width === undefined && depth === undefined && height === undefined && diameter === undefined) {
    return null;
  }
  return { width, depth, height, diameter, unit };
}

/** schema.org QuantitativeValue for a single dimension. */
export function quantitativeValue(value: number | undefined, unitCode: string) {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return { "@type": "QuantitativeValue", value, unitCode };
}

interface SpecTableProps {
  dimensions?: string | null;
  materials?: string | null;
  materialsDescription?: string | null;
  upholsteryOptions?: string[];
  sku?: string | null;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-4 py-2 border-b border-border/50 last:border-0">
    <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground w-32 shrink-0">
      {label}
    </dt>
    <dd className="font-body text-sm text-foreground leading-relaxed">{value}</dd>
  </div>
);

/**
 * Always-public specification table. Rendered as plain semantic HTML so search
 * engines and AI crawlers can read every physical spec without a session.
 */
export function PublicSpecTable({
  dimensions,
  materials,
  materialsDescription,
  upholsteryOptions = [],
  sku,
}: SpecTableProps) {
  const dims = parseDimensions(dimensions);
  const unitLabel = dims?.unit === "INH" ? "in" : "cm";
  const rows: { label: string; value: string }[] = [];

  if (dims?.width !== undefined) rows.push({ label: "Width", value: `${dims.width} ${unitLabel}` });
  if (dims?.depth !== undefined) rows.push({ label: "Depth", value: `${dims.depth} ${unitLabel}` });
  if (dims?.height !== undefined) rows.push({ label: "Height", value: `${dims.height} ${unitLabel}` });
  if (dims?.diameter !== undefined) rows.push({ label: "Diameter", value: `${dims.diameter} ${unitLabel}` });
  if (!rows.length && dimensions) rows.push({ label: "Dimensions", value: dimensions });

  const frame = materials || materialsDescription;
  if (frame) rows.push({ label: "Frame Material", value: frame });
  if (upholsteryOptions.length)
    rows.push({ label: "Upholstery Options", value: upholsteryOptions.join(" · ") });
  if (!rows.length) return null;

  // Kept in the DOM for crawlers/AI search, but visually hidden: dimensions and
  // finishes are already surfaced in the page header and finish selector.
  return (
    <section aria-label="Specifications" className="sr-only">
      <h2>Specifications</h2>
      <dl>
        {rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
      </dl>
    </section>
  );
}

/** Trade tools previewed in the exclusive-access lightbox. */
export const TRADE_FEATURE_MATRIX: { title: string; description: string }[] = [
  {
    title: "AI Curatorial Co-Pilot",
    description: "Draft quotes, compile spec sheets, and research our database instantly.",
  },
  {
    title: "3D Axonometric Studio",
    description: "Configure bespoke finishes, customize dimensions, and preview in real-time.",
  },
  {
    title: "Trade Logistics",
    description: "Secure exclusive contract margins and manage multi-room project client presentations.",
  },
];

/**
 * Signed-out paywall shown in place of trade price, lead times and CAD files.
 * `onRequestQuote` opens the dedicated product quote/customisation form.
 * `showFeatureMatrix` (lightbox only) appends the trade-tools preview grid
 * below the action buttons.
 */
export function TradeExclusiveCard({
  redirectTo,
  onRequestQuote,
  rrpLabel,
  showFeatureMatrix = false,
}: {
  redirectTo?: string;
  onRequestQuote?: () => void;
  rrpLabel?: string | null;
  showFeatureMatrix?: boolean;
}) {
  const q = new URLSearchParams();
  if (redirectTo) q.set("redirect", redirectTo);
  const loginHref = `/trade/login${q.toString() ? `?${q.toString()}` : ""}`;

  const applyHref = `/trade/apply${q.toString() ? `?${q.toString()}` : ""}`;

  return (
    <div className="rounded-none border border-border/60 bg-muted/30 p-5 md:p-6">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Lock className="h-3 w-3 text-[hsl(var(--gold))]" aria-hidden="true" />
        <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Trade Exclusive Access
        </span>
      </div>
      <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed text-center max-w-sm mx-auto">
        {rrpLabel ? (
          <>
            The Public retail price is shown above. Unlock Your Trade pricing, access projects &
            client management tools, logistical data, and your own AI curatorial guide.
          </>
        ) : (
          "View pricing, access projects & client management tools, logistical data, and AI curatorial guide."
        )}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          to={loginHref}
          className="inline-flex h-12 w-full items-center justify-center px-3 rounded-none bg-foreground text-background font-body text-[11px] leading-none uppercase tracking-[0.12em] hover:bg-foreground/85 transition-colors"
        >
          Sign In
        </Link>
        <Link
          to={applyHref}
          className="inline-flex h-12 w-full items-center justify-center px-3 rounded-none border border-foreground text-foreground font-body text-[11px] leading-none uppercase tracking-[0.12em] hover:bg-muted/60 transition-colors"
        >
          Apply for Trade Account
        </Link>
      </div>

      {showFeatureMatrix && (
        <>
          <div className="mt-6 border-t border-border/60" />
          <div
            aria-label="Trade member tools"
            className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-5"
          >
            {TRADE_FEATURE_MATRIX.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-1.5">
                <p className="font-body text-[10px] uppercase tracking-widest font-normal text-foreground">
                  {feature.title}
                </p>
                <p className="font-body text-[10px] font-light leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}



export default PublicSpecTable;
