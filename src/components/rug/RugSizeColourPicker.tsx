/**
 * Per-square-metre rug picker: stock sizes as radios + a "Custom dimensions"
 * mode that reveals L × W inputs with a cm/inch toggle. Colour is rendered
 * the same way (stock colours + an optional "Custom colour" free-text).
 *
 * Live price = Price/m² × (L × W in m²), rendered in the product's currency.
 * Emits a synthesised variant label like "300 × 400 cm · Indigo" so existing
 * quote / concierge flows can record exactly what the user picked, plus the
 * computed `totalCents` for the order line.
 */
import { useEffect, useMemo, useState } from "react";
import { Ruler, Palette } from "lucide-react";
import { parseRugDims, dimsToSqm, computeRugPriceCents } from "@/lib/rugPricing";
import { cn } from "@/lib/utils";

export interface RugSelection {
  sizeLabel: string;        // e.g. "300 × 400 cm" or "Custom: 220 × 350 cm"
  colour: string | null;    // e.g. "Indigo" or "Custom: emerald" or null
  isCustomSize: boolean;
  isCustomColour: boolean;
  widthCm: number | null;
  lengthCm: number | null;
  totalCents: number | null;
}

interface SizeRow {
  base?: string;
  top?: string;
  label?: string;
  price_cents?: number;
}

interface Props {
  sizeVariants: SizeRow[];
  pricePerSqmCents: number;
  currency: string;
  sizeAxisLabel?: string | null;
  colourAxisLabel?: string | null;
  hidePrice?: boolean;
  onChange: (sel: RugSelection) => void;
}

type Unit = "cm" | "in";

function formatPrice(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const CUSTOM_SIZE_KEY = "__custom__";
const CUSTOM_COLOUR_KEY = "__custom__";

export default function RugSizeColourPicker({
  sizeVariants,
  pricePerSqmCents,
  currency,
  sizeAxisLabel,
  colourAxisLabel,
  onChange,
}: Props) {
  // Parse stock sizes from the variant.base column (or label as fallback).
  const stockSizes = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string; widthCm: number; lengthCm: number }[] = [];
    for (const v of sizeVariants || []) {
      const src = (v.base || v.label || "").trim();
      if (!src) continue;
      const dims = parseRugDims(src);
      if (!dims) continue;
      const key = `${dims.widthCm}x${dims.lengthCm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: src, widthCm: dims.widthCm, lengthCm: dims.lengthCm });
    }
    return out;
  }, [sizeVariants]);

  // Unique colours from top column. Filter out placeholder "TBC".
  const stockColours = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of sizeVariants || []) {
      const t = (v.top || "").trim();
      if (!t || /^tbc$/i.test(t)) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }, [sizeVariants]);

  const [sizeKey, setSizeKey] = useState<string>(stockSizes[0]?.key ?? CUSTOM_SIZE_KEY);
  const [unit, setUnit] = useState<Unit>("cm");
  const [lengthInput, setLengthInput] = useState<string>("");
  const [widthInput, setWidthInput] = useState<string>("");
  const [colour, setColour] = useState<string | null>(stockColours[0] ?? null);
  const [customColour, setCustomColour] = useState<string>("");

  const isCustomSize = sizeKey === CUSTOM_SIZE_KEY;
  const isCustomColour = colour === CUSTOM_COLOUR_KEY;

  // Resolve current dimensions in cm.
  const { widthCm, lengthCm } = useMemo(() => {
    if (!isCustomSize) {
      const row = stockSizes.find((s) => s.key === sizeKey);
      return { widthCm: row?.widthCm ?? null, lengthCm: row?.lengthCm ?? null };
    }
    const l = parseFloat(lengthInput.replace(",", "."));
    const w = parseFloat(widthInput.replace(",", "."));
    if (!Number.isFinite(l) || !Number.isFinite(w) || l <= 0 || w <= 0) {
      return { widthCm: null, lengthCm: null };
    }
    const factor = unit === "in" ? 2.54 : 1;
    return { widthCm: Math.round(w * factor), lengthCm: Math.round(l * factor) };
  }, [isCustomSize, sizeKey, stockSizes, lengthInput, widthInput, unit]);

  const totalCents = useMemo(() => {
    if (widthCm == null || lengthCm == null) return null;
    return computeRugPriceCents(dimsToSqm(widthCm, lengthCm), pricePerSqmCents);
  }, [widthCm, lengthCm, pricePerSqmCents]);

  // Emit selection upstream.
  useEffect(() => {
    const sizeLabel = isCustomSize
      ? widthCm && lengthCm
        ? `Custom: ${lengthCm} × ${widthCm} cm`
        : "Custom size (pending)"
      : stockSizes.find((s) => s.key === sizeKey)?.label ?? "";
    const resolvedColour = isCustomColour
      ? customColour.trim()
        ? `Custom: ${customColour.trim()}`
        : null
      : colour;
    onChange({
      sizeLabel,
      colour: resolvedColour,
      isCustomSize,
      isCustomColour,
      widthCm,
      lengthCm,
      totalCents,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeKey, isCustomSize, isCustomColour, widthCm, lengthCm, colour, customColour, totalCents]);

  const sizeAxis = (sizeAxisLabel || "Size").trim();
  const colourAxis = (colourAxisLabel || "Colour").trim();

  return (
    <div className="space-y-5">
      {/* SIZE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="flex items-center gap-2 font-display text-sm tracking-wide text-foreground">
            <Ruler size={14} className="text-[hsl(var(--gold))]" />
            Select {sizeAxis}
          </span>
          <span className="font-body text-xs text-muted-foreground">
            {isCustomSize ? "Enter your dimensions below" : stockSizes.find((s) => s.key === sizeKey)?.label}
          </span>
        </div>

        <div className="space-y-2 pl-1">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="rug-size"
              checked={isCustomSize}
              onChange={() => setSizeKey(CUSTOM_SIZE_KEY)}
              className="h-4 w-4 accent-foreground"
            />
            <span className="font-body text-sm text-foreground group-hover:text-foreground">
              Enter your dimensions below
            </span>
          </label>
          {stockSizes.map((s) => (
            <label key={s.key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="rug-size"
                checked={sizeKey === s.key}
                onChange={() => setSizeKey(s.key)}
                className="h-4 w-4 accent-foreground"
              />
              <span className="font-body text-sm text-muted-foreground group-hover:text-foreground">
                {s.label}
              </span>
            </label>
          ))}
        </div>

        {isCustomSize && (
          <div className="space-y-2">
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Length</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={lengthInput}
                  onChange={(e) => setLengthInput(e.target.value)}
                  className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Width</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={widthInput}
                  onChange={(e) => setWidthInput(e.target.value)}
                  className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <div className="inline-flex rounded-md border border-input overflow-hidden text-xs">
                {(["cm", "in"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={cn(
                      "px-3 py-2 transition-colors",
                      unit === u
                        ? "bg-foreground text-background"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {isCustomSize && (widthCm == null || lengthCm == null) && (lengthInput || widthInput) && (
              <p className="font-body text-[11px] text-destructive">Kindly add both length and width.</p>
            )}
            {widthCm != null && lengthCm != null && (
              <p className="font-body text-[11px] text-muted-foreground">
                {lengthCm} × {widthCm} cm · {(dimsToSqm(widthCm, lengthCm)).toFixed(2)} m²
              </p>
            )}
          </div>
        )}
      </div>

      {/* COLOUR */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="flex items-center gap-2 font-display text-sm tracking-wide text-foreground">
            <Palette size={14} className="text-[hsl(var(--gold))]" />
            Select {colourAxis}
          </span>
        </div>

        <div className="space-y-2 pl-1">
          {stockColours.map((c) => (
            <label key={c} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="rug-colour"
                checked={colour === c}
                onChange={() => setColour(c)}
                className="h-4 w-4 accent-foreground"
              />
              <span className="font-body text-sm text-muted-foreground group-hover:text-foreground">{c}</span>
            </label>
          ))}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="rug-colour"
              checked={isCustomColour}
              onChange={() => setColour(CUSTOM_COLOUR_KEY)}
              className="h-4 w-4 accent-foreground"
            />
            <span className="font-body text-sm text-foreground group-hover:text-foreground">
              Enter your custom {colourAxis.toLowerCase()} below
            </span>
          </label>
          {isCustomColour && (
            <input
              type="text"
              value={customColour}
              onChange={(e) => setCustomColour(e.target.value)}
              placeholder={`Describe your ${colourAxis.toLowerCase()}`}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}
        </div>
      </div>

      {/* PRICE */}
      <div className="rounded-md border border-border/60 bg-muted/30 p-3 flex items-baseline justify-between">
        <span className="font-body text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {totalCents != null ? "Price for your selection" : "Enter dimensions for a price"}
        </span>
        <span className="font-display text-lg text-foreground">
          {totalCents != null ? formatPrice(totalCents, currency) : "—"}
        </span>
      </div>
      <p className="font-body text-[11px] text-muted-foreground">
        Calculated at {formatPrice(pricePerSqmCents, currency)} / m². Final lead time confirmed after order.
      </p>
    </div>
  );
}
