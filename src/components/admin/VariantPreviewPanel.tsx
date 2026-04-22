/**
 * Inline admin preview of how `size_variants` will render publicly.
 * Mirrors the dropdown logic used in PublicProductPage / PublicProductLightbox
 * so curators can verify selections before publishing — without leaving the editor.
 */
import { useMemo, useState } from "react";
import { Ruler, Layers, Eye } from "lucide-react";

export interface VariantPreviewProps {
  sizeVariants: { label?: string; base?: string; top?: string; price_cents?: number }[] | null | undefined;
  variantPlaceholder?: string | null;
  dimensions?: string | null;
  materials?: string | null;
  currency?: string | null;
  baseAxisLabel?: string | null;
  topAxisLabel?: string | null;
}

export default function VariantPreviewPanel({
  sizeVariants,
  variantPlaceholder,
  dimensions,
  materials,
  currency,
  baseAxisLabel,
  topAxisLabel,
}: VariantPreviewProps) {
  const sv = sizeVariants || [];
  const isDualAxis = sv.length > 0 && sv.some((v) => (v.base && v.base.trim()) || (v.top && v.top.trim()));

  const sizeOptions = useMemo(() => {
    if (isDualAxis) {
      return Array.from(new Set(sv.map((v) => (v.label || "").trim()).filter(Boolean)));
    }
    return Array.from(new Set(sv.map((v) => (v.label || "").trim()).filter(Boolean)));
  }, [sv, isDualAxis]);

  const baseOptions = useMemo(
    () => (isDualAxis ? Array.from(new Set(sv.map((v) => (v.base || "").trim()).filter(Boolean))) : []),
    [sv, isDualAxis]
  );
  const topOptions = useMemo(
    () => (isDualAxis ? Array.from(new Set(sv.map((v) => (v.top || "").trim()).filter(Boolean))) : []),
    [sv, isDualAxis]
  );

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [selectedTop, setSelectedTop] = useState<string>("");

  const matched = useMemo(() => {
    if (isDualAxis) {
      return sv.find(
        (v) =>
          (!selectedSize || (v.label || "").trim() === selectedSize) &&
          (!selectedBase || (v.base || "").trim() === selectedBase) &&
          (!selectedTop || (v.top || "").trim() === selectedTop)
      );
    }
    return sv.find((v) => (v.label || "").trim() === selectedSize);
  }, [sv, isDualAxis, selectedSize, selectedBase, selectedTop]);

  const sizePlaceholder = "Select your size";
  const materialPlaceholder = variantPlaceholder || "Select your material choice";

  const showSizeDropdown = sizeOptions.length > 1;
  const fallbackDimensions = !showSizeDropdown && dimensions;

  return (
    <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <Eye className="h-3 w-3" />
        Public preview — variant selectors
      </div>

      {sv.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">
          No variants configured. Public page will show the static dimensions / materials fields.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Materials / fabric / base+top selectors */}
          {isDualAxis ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" /> {baseAxisLabel || "Base"}
                </span>
                <select
                  className="rounded border bg-background px-2 py-1.5 text-xs"
                  value={selectedBase}
                  onChange={(e) => setSelectedBase(e.target.value)}
                >
                  <option value="">
                    {variantPlaceholder ||
                      `Select your ${(baseAxisLabel || "base").toLowerCase()} choice`}
                  </option>
                  {baseOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" /> {topAxisLabel || "Top"}
                </span>
                <select
                  className="rounded border bg-background px-2 py-1.5 text-xs"
                  value={selectedTop}
                  onChange={(e) => setSelectedTop(e.target.value)}
                >
                  <option value="">
                    {variantPlaceholder ||
                      `Select your ${(topAxisLabel || "top").toLowerCase()} choice`}
                  </option>
                  {topOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : materials ? (
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" /> Materials (static)
              </span>
              <div className="rounded border bg-background px-2 py-1.5 text-xs">{materials}</div>
            </label>
          ) : null}

          {/* Size selector */}
          {showSizeDropdown ? (
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Size
              </span>
              <select
                className="rounded border bg-background px-2 py-1.5 text-xs"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
              >
                <option value="">{sizePlaceholder}</option>
                {sizeOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          ) : fallbackDimensions ? (
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Dimensions (static)
              </span>
              <div className="rounded border bg-background px-2 py-1.5 text-xs whitespace-pre-line">{dimensions}</div>
            </label>
          ) : null}

          {/* Live price feedback */}
          {matched?.price_cents != null && matched.price_cents > 0 && (
            <div className="text-[11px] text-foreground">
              Price for selection:{" "}
              <span className="font-medium">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: currency || "EUR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(matched.price_cents / 100)}
              </span>
            </div>
          )}
          {!matched && (selectedSize || selectedBase || selectedTop) && (
            <div className="text-[11px] text-destructive">
              No matching variant row for this combination.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
