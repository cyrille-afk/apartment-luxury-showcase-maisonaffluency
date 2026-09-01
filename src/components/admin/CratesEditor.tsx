/**
 * Crates & customs editor for the Designer Editor product card.
 *
 * Lets an admin declare several crates per product, link each crate to a
 * specific size variant (or leave it applying to all sizes), price the crating,
 * and declare HS codes that vary by material/finish.
 */
import { useMemo } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CrateSpec,
  HsCodeRule,
  CRATE_MATERIAL_PRESETS,
  crateCbm,
  crateTotals,
  emptyCrate,
  emptyHsRule,
  parseCrateSpecs,
  parseHsCodeRules,
} from "@/lib/crateSpecs";

interface CratesEditorProps {
  crateSpecsRaw: unknown;
  hsCodeRulesRaw: unknown;
  /** `size_variants` JSONB of the pick — used to offer the size link options. */
  sizeVariantsRaw: unknown;
  currency?: string | null;
  onChangeCrates: (next: CrateSpec[]) => void;
  onChangeHsRules: (next: HsCodeRule[]) => void;
}

const numOrNull = (v: string) => {
  if (v.trim() === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function CratesEditor({
  crateSpecsRaw,
  hsCodeRulesRaw,
  sizeVariantsRaw,
  currency,
  onChangeCrates,
  onChangeHsRules,
}: CratesEditorProps) {
  const crates = useMemo(() => parseCrateSpecs(crateSpecsRaw), [crateSpecsRaw]);
  const rules = useMemo(() => parseHsCodeRules(hsCodeRulesRaw), [hsCodeRulesRaw]);

  const sizeOptions = useMemo(() => {
    if (!Array.isArray(sizeVariantsRaw)) return [] as string[];
    const seen = new Set<string>();
    for (const v of sizeVariantsRaw as Array<Record<string, unknown>>) {
      const label = typeof v?.label === "string" ? v.label.trim() : "";
      if (label) seen.add(label);
    }
    return Array.from(seen);
  }, [sizeVariantsRaw]);

  const patch = (id: string, changes: Partial<CrateSpec>) => {
    onChangeCrates(
      crates.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...changes };
        // Keep CBM in sync whenever a dimension changes.
        if ("length_cm" in changes || "width_cm" in changes || "height_cm" in changes) {
          next.cbm = crateCbm(next);
        }
        return next;
      })
    );
  };

  const totals = crateTotals(crates);

  return (
    <div className="space-y-3 border border-dashed border-border rounded-md p-2.5 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
          <Package className="h-3 w-3" />
          Crates &amp; customs
          <span className="italic normal-case font-normal">
            — multiple crates per product, linked to sizes
          </span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => onChangeCrates([...crates, emptyCrate(currency || "EUR")])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add crate
        </Button>
      </div>

      {crates.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic">
          No crates declared — the single packing CBM / weight above is used.
        </p>
      )}

      {crates.map((c, i) => (
        <div key={c.id} className="rounded-md border border-border bg-background p-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 shrink-0">#{i + 1}</span>
            <Input
              value={c.label}
              onChange={(e) => patch(c.id, { label: e.target.value })}
              placeholder="Crate label — e.g. Seat shell"
              className="text-xs h-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive"
              onClick={() => onChangeCrates(crates.filter((x) => x.id !== c.id))}
              title="Remove crate"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground">Applies to size</label>
              <select
                value={c.size_label}
                onChange={(e) => patch(c.id, { size_label: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-input bg-background rounded-md"
              >
                <option value="">All sizes</option>
                {sizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {c.size_label && !sizeOptions.includes(c.size_label) && (
                  <option value={c.size_label}>{c.size_label}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Qty per unit</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={String(c.qty ?? 1)}
                onChange={(e) =>
                  patch(c.id, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Weight (kg)</label>
              <Input
                type="number"
                step="0.01"
                value={c.weight_kg != null ? String(c.weight_kg) : ""}
                onChange={(e) => patch(c.id, { weight_kg: numOrNull(e.target.value) })}
                placeholder="e.g. 42"
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground">
                Crate dimensions (cm) — L × W × H
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  step="0.1"
                  value={c.length_cm != null ? String(c.length_cm) : ""}
                  onChange={(e) => patch(c.id, { length_cm: numOrNull(e.target.value) })}
                  placeholder="L"
                  className="text-xs h-8"
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  step="0.1"
                  value={c.width_cm != null ? String(c.width_cm) : ""}
                  onChange={(e) => patch(c.id, { width_cm: numOrNull(e.target.value) })}
                  placeholder="W"
                  className="text-xs h-8"
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  step="0.1"
                  value={c.height_cm != null ? String(c.height_cm) : ""}
                  onChange={(e) => patch(c.id, { height_cm: numOrNull(e.target.value) })}
                  placeholder="H"
                  className="text-xs h-8"
                />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {c.cbm != null ? `${c.cbm.toFixed(3)} m³` : "m³"}
                </span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">
                Crate price ({c.currency || currency || "EUR"})
              </label>
              <Input
                type="number"
                step="0.01"
                value={c.crate_price_cents != null ? String(c.crate_price_cents / 100) : ""}
                onChange={(e) => {
                  const n = numOrNull(e.target.value);
                  patch(c.id, { crate_price_cents: n == null ? null : Math.round(n * 100) });
                }}
                placeholder="e.g. 180"
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">HS code (this crate)</label>
              <Input
                value={c.hs_code}
                onChange={(e) =>
                  patch(c.id, { hs_code: e.target.value.replace(/[^0-9.]/g, "").slice(0, 14) })
                }
                placeholder="optional"
                className="text-xs h-8"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>
      ))}

      {crates.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Totals (all crates): {totals.count} crate{totals.count === 1 ? "" : "s"} ·{" "}
          {totals.cbm.toFixed(3)} m³ · {totals.weightKg} kg · crating{" "}
          {(totals.priceCents / 100).toLocaleString(undefined, {
            style: "currency",
            currency: totals.currency || "EUR",
            maximumFractionDigits: 0,
          })}
        </p>
      )}

      {/* HS codes by material / finish */}
      <div className="pt-1 border-t border-border/60 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            HS codes by material{" "}
            <span className="italic normal-case font-normal">
              — matched against the selected finish (wood, marble, metal…)
            </span>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => onChangeHsRules([...rules, emptyHsRule()])}
          >
            <Plus className="h-3 w-3 mr-1" /> Add rule
          </Button>
        </div>

        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input
              value={r.material}
              onChange={(e) =>
                onChangeHsRules(
                  rules.map((x) => (x.id === r.id ? { ...x, material: e.target.value } : x))
                )
              }
              placeholder="Material / finish keyword — e.g. Marble"
              className="text-xs h-8"
              list="crate-material-presets"
            />
            <Input
              value={r.hs_code}
              onChange={(e) =>
                onChangeHsRules(
                  rules.map((x) =>
                    x.id === r.id
                      ? { ...x, hs_code: e.target.value.replace(/[^0-9.]/g, "").slice(0, 14) }
                      : x
                  )
                )
              }
              placeholder="9403.60"
              className="text-xs h-8 max-w-[140px]"
              inputMode="numeric"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive"
              onClick={() => onChangeHsRules(rules.filter((x) => x.id !== r.id))}
              title="Remove rule"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <datalist id="crate-material-presets">
          {CRATE_MATERIAL_PRESETS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {rules.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">
            No material rules — the single HS code above applies to every finish.
          </p>
        )}
      </div>
    </div>
  );
}
