import { useState, useMemo } from "react";
import { Scissors, X } from "lucide-react";
import {
  type FabricOption,
  computeFabricUpchargeCents,
  fabricTierLabel,
  ccySym,
} from "@/lib/fabricUpcharge";

interface FabricUpchargeRowProps {
  options: FabricOption[];
  comMetersDefault: number | null;
  currentFabricId: string | null;
  currentMeters: number | null;
  currentUpchargeCents: number | null;
  currentFabricCurrency: string | null;
  quoteCurrency: string;
  convertCents: (cents: number | null, from: string, to: string) => number | null;
  canEdit: boolean;
  onChange: (patch: {
    fabric_id: string | null;
    fabric_meters: number | null;
    fabric_upcharge_cents: number | null;
    fabric_currency: string | null;
  }) => void;
}

/**
 * Per-line fabric / leather upcharge picker, shown only when the product has
 * at least one fabric option linked in product_fabrics. Compact UI:
 *
 *  + Add fabric upcharge        (when none selected)
 *  ✂ Cole Cinnamon · CAT E · €750/lm × [12] m  = €9,000   ✕
 *                                (converted: S$ 13,200)
 */
export default function FabricUpchargeRow({
  options,
  comMetersDefault,
  currentFabricId,
  currentMeters,
  currentUpchargeCents,
  currentFabricCurrency,
  quoteCurrency,
  convertCents,
  canEdit,
  onChange,
}: FabricUpchargeRowProps) {
  const fabricOptions = useMemo(
    () => options.filter((f) => f.price_per_lm_cents && f.price_per_lm_cents > 0),
    [options],
  );

  const [pickerOpen, setPickerOpen] = useState(false);

  const current = useMemo(
    () => options.find((f) => f.id === currentFabricId) || null,
    [options, currentFabricId],
  );

  // Convert snapshot upcharge for display
  const upchargeQuoteCents =
    currentUpchargeCents
      ? (convertCents(currentUpchargeCents, currentFabricCurrency || "EUR", quoteCurrency) ?? currentUpchargeCents)
      : null;

  const selectFabric = (fabricId: string) => {
    const f = options.find((x) => x.id === fabricId);
    if (!f) return;
    const meters = currentMeters ?? comMetersDefault ?? null;
    const upcharge = computeFabricUpchargeCents(f, meters);
    onChange({
      fabric_id: f.id,
      fabric_meters: meters,
      fabric_upcharge_cents: upcharge,
      fabric_currency: f.currency || "EUR",
    });
    setPickerOpen(false);
  };

  const setMeters = (m: number | null) => {
    if (!current) return;
    const upcharge = computeFabricUpchargeCents(current, m);
    onChange({
      fabric_id: current.id,
      fabric_meters: m,
      fabric_upcharge_cents: upcharge,
      fabric_currency: current.currency || "EUR",
    });
  };

  const clear = () => {
    onChange({
      fabric_id: null,
      fabric_meters: null,
      fabric_upcharge_cents: null,
      fabric_currency: null,
    });
  };

  if (!fabricOptions.length && !current) return null;

  // ── Selected fabric: show summary line ─────────────────────────────────
  if (current) {
    const showConversion =
      upchargeQuoteCents && currentFabricCurrency && currentFabricCurrency !== quoteCurrency;

    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded border border-primary/20 bg-primary/[0.03] px-2 py-1">
        <Scissors className="h-2.5 w-2.5 text-primary/70 shrink-0" />
        <span className="font-body text-[10px] md:text-[11px] text-foreground">
          <span className="text-muted-foreground">Fabric:</span>{" "}
          <span className="font-medium">{current.name}</span>
          {current.tier && <span className="text-muted-foreground"> · CAT {current.tier}</span>}
          {current.price_per_lm_cents && (
            <span className="text-muted-foreground">
              {" · "}
              {ccySym(current.currency || "EUR")}
              {(current.price_per_lm_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/lm
            </span>
          )}
        </span>
        <span className="text-muted-foreground text-[10px]">×</span>
        {canEdit ? (
          <input
            type="number"
            step="0.5"
            min="0"
            value={currentMeters ?? ""}
            placeholder={comMetersDefault ? String(comMetersDefault) : "m"}
            onChange={(e) => setMeters(e.target.value === "" ? null : Number(e.target.value))}
            className="w-12 px-1 py-0.5 text-[11px] tabular-nums rounded border border-border bg-background text-right"
          />
        ) : (
          <span className="text-[11px] tabular-nums">{currentMeters ?? "—"}</span>
        )}
        <span className="text-muted-foreground text-[10px]">m</span>
        {currentUpchargeCents && (
          <span className="ml-auto font-body text-[11px] text-foreground tabular-nums">
            {" = "}
            {ccySym(currentFabricCurrency || "EUR")}
            {(currentUpchargeCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            {showConversion && (
              <span className="text-muted-foreground">
                {" ("}
                {ccySym(quoteCurrency)}
                {(upchargeQuoteCents! / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {")"}
              </span>
            )}
          </span>
        )}
        {canEdit && (
          <button
            onClick={clear}
            className="p-0.5 text-muted-foreground hover:text-destructive"
            title="Remove fabric"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // ── No fabric yet: trigger + popover-style picker ───────────────────────
  if (!canEdit) return null;

  return (
    <div className="mt-1.5">
      {!pickerOpen ? (
        <button
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1 font-body text-[10px] text-primary/80 hover:text-primary"
        >
          <Scissors className="h-3 w-3" /> Add fabric upcharge
        </button>
      ) : (
        <div className="rounded border border-primary/30 bg-primary/[0.03] p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
              Select fabric — {fabricOptions.length} available
              {comMetersDefault && (
                <span className="text-foreground/70"> · default {comMetersDefault} m</span>
              )}
            </span>
            <button onClick={() => setPickerOpen(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-48 overflow-auto divide-y divide-border/50">
            {fabricOptions.map((f) => (
              <button
                key={f.id}
                onClick={() => selectFabric(f.id)}
                className="w-full flex items-center gap-2 text-left px-1.5 py-1 hover:bg-muted/40 rounded"
              >
                {f.image_url && (
                  <img src={f.image_url} alt="" className="h-6 w-6 rounded object-cover border border-border shrink-0" />
                )}
                <span className="font-body text-xs text-foreground flex-1 truncate">{f.name}</span>
                <span className="font-body text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {fabricTierLabel(f)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
