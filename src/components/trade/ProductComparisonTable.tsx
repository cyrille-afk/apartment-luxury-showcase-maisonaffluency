import { useEffect, useMemo, useState, type ReactNode } from "react";
import { comparatorFacets, comparatorFinishNames, finishFacetKey, groupedMaterialOptions, matchesComparatorFacets, materialOptionLabel, materialTypeOptions, selectMaterialOption, type FinishFacetOverride } from "@/lib/comparatorFacets";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TradeProduct } from "@/lib/tradeProducts";
import { differingSpecificationCells } from "@/lib/comparatorDifferences";
import { ComparatorMaterialSwatches } from "./ComparatorMaterialSwatches";
import { useComparatorSwatches } from "@/hooks/useComparatorSwatches";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FinishCategoryDialog } from "./FinishCategoryDialog";
import { ComparatorDimensions } from "./ComparatorDimensions";
import { comparatorEditionLabel } from "@/lib/comparatorEditionLabel";

interface ComparisonField { key: string; label: string }
interface Props {
  products: (TradeProduct | null)[];
  fields: ComparisonField[];
  onRemove: (id: string) => void;
  renderPrice: (product: TradeProduct | null, net: boolean) => ReactNode;
  renderNote?: (product: TradeProduct) => ReactNode;
  onVisibleProductsChange?: (visible: TradeProduct[] | null) => void;
}

const NO_OVERRIDES = new Map<string, FinishFacetOverride>();

export function ProductComparisonTable({ products: allProducts, fields, onRemove, renderPrice, renderNote, onVisibleProductsChange }: Props) {
  const { data: swatches, isLoading: swatchesLoading } = useComparatorSwatches(allProducts.flatMap(product => product ? [product.id] : []));
  const { isAdmin } = useAuth();
  const { data: overrides = NO_OVERRIDES } = useQuery({
    queryKey: ["finish-facet-overrides"], staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("finish_facet_overrides").select("finish_key,material,finish,color");
      if (error) throw error;
      return new Map<string, FinishFacetOverride>((data ?? []).map(r => [r.finish_key, { material: r.material, finish: r.finish, color: r.color }]));
    },
  });
  const finishNames = useMemo(() => { const seen = new Map<string, string>(); for (const p of allProducts) if (p) for (const n of comparatorFinishNames(p.materials as string | null, swatches?.get(p.id))) if (!seen.has(finishFacetKey(n))) seen.set(finishFacetKey(n), n); return [...seen.values()].sort((a, b) => a.localeCompare(b)); }, [allProducts, swatches]);
  const categorisablePieces = useMemo(() => allProducts.flatMap(p => p ? [{ name: p.product_name, materials: (p.materials as string | null) ?? null, linked: swatches?.get(p.id) ?? [] }] : []), [allProducts, swatches]);
  const [selection, setSelection] = useState<{ material?: string; materialType?: string }>({});
  const facetsById = useMemo(() => new Map(allProducts.flatMap(p => p ? [[p.id, comparatorFacets(p.materials as string | null, swatches?.get(p.id), overrides)] as const] : [])), [allProducts, swatches, overrides]);
  const options = useMemo(() => ({ material: [...new Set([...facetsById.values()].flatMap(f => f.material))].sort() }), [facetsById]);
  const materialGroups = useMemo(() => groupedMaterialOptions(options.material), [options.material]);
  const materialItems = useMemo(() => new Set(materialGroups.flatMap(g => g.items)), [materialGroups]);
  const materialValue = selection.materialType && materialItems.has(selection.materialType) ? selection.materialType : selection.material && materialItems.has(selection.material) ? selection.material : "all";
  const active = Object.values(selection).some(Boolean);
  const products = active ? allProducts.filter(p => {
    if (!p) return false;
    const facets = facetsById.get(p.id);
    return facets ? matchesComparatorFacets(facets, selection) : false;
  }) : allProducts;
  const visibleSignature = products.map(p => p?.id ?? "").join("|");
  useEffect(() => {
    onVisibleProductsChange?.(active ? products.filter((p): p is TradeProduct => !!p) : null);
  }, [active, visibleSignature, onVisibleProductsChange]);
  const hasOptions = options.material.length > 0;
  const labelColumnWidth = "11rem";
  const productColumnWidth = `calc((100% - ${labelColumnWidth}) / ${Math.max(products.length, 1)})`;
  return <div>
    {(hasOptions || (isAdmin && finishNames.length > 0)) && <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-border/60 pb-5" role="group" aria-label="Filter compared products">
      {options.material.length > 0 && <label className="flex w-full flex-col gap-1.5 sm:w-64">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/70">Material</span>
        <Select value={materialValue} onValueChange={v => setSelection(s => ({ ...s, ...selectMaterialOption(v) }))}>
          <SelectTrigger aria-label="Material" className="h-9 w-full border border-border bg-background px-3 font-body text-sm text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80 min-w-48">
            <SelectItem value="all">All</SelectItem>
            {materialGroups.map(g => <SelectGroup key={g.header}>
              <SelectLabel className="font-body text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">{g.header}</SelectLabel>
              {g.items.map(v => <SelectItem key={v} value={v}>{materialOptionLabel(v)}</SelectItem>)}
            </SelectGroup>)}
          </SelectContent>
        </Select>
      </label>}
      {selection.material && materialTypeOptions(options.material, selection.material).length > 0 && <label className="flex flex-col gap-1.5">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/70">Type</span>
        <select value={selection.materialType ?? ""} onChange={e => setSelection(s => ({ ...s, materialType: e.target.value || undefined }))} className="h-9 min-w-40 border border-border bg-background px-3 font-body text-sm text-foreground">
          <option value="">All</option>
          {materialTypeOptions(options.material, selection.material).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>}
      {active && <Button type="button" variant="ghost" size="sm" onClick={() => setSelection({})}>Clear filters</Button>}
      {isAdmin && finishNames.length > 0 && <FinishCategoryDialog names={finishNames} overrides={overrides} pieces={categorisablePieces} />}
      {active && <p className="pb-2 font-body text-xs text-muted-foreground" aria-live="polite">Showing {products.length} of {allProducts.filter(Boolean).length} pieces</p>}
    </div>}
    {active && products.length === 0 ? <p className="py-12 font-body text-sm text-muted-foreground">No compared pieces match these filters.</p> :
  <div className="overflow-x-auto" role="region" aria-label="Product comparison" tabIndex={0}>
    <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
      <caption className="sr-only">Selected products, specifications and pricing</caption>
      <colgroup>
        <col style={{ width: labelColumnWidth }} />
        {products.map((_, index) => <col key={index} style={{ width: productColumnWidth }} />)}
      </colgroup>
      <thead>
        <tr className="border-b border-border">
          <th scope="col"><span className="sr-only">Specification</span></th>
          {products.map((product, index) => <th scope="col" key={product?.id ?? `heading-${index}`} className="px-3 pb-6 pt-1 text-left align-top">
            <div className="flex h-9 items-center justify-center pb-2">
              {product && <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(product.id)} className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label={`Remove ${product.product_name}`}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger><TooltipContent>Remove {product.product_name}</TooltipContent></Tooltip>}
            </div>
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
              {product?.image_url ? <img src={product.image_url} alt={product.product_name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center px-5 font-body text-xs font-normal text-muted-foreground">{product ? product.product_name : `Select product ${index + 1}`}</div>}
              {product && comparatorEditionLabel(product) && <p className="absolute left-3 top-3 max-w-[85%] bg-background/85 px-2 py-1 text-left font-body text-[10px] font-semibold uppercase leading-snug text-foreground backdrop-blur-sm">{comparatorEditionLabel(product)}</p>}
            </div>
            <p className="mt-4 min-h-12 break-words text-left font-display text-base font-normal leading-snug text-foreground">{product?.product_name ?? "—"}</p>
          </th>)}
        </tr>
      </thead>
      <tbody>
        {fields.map(field => {
          const trade = field.key === "trade_price_cents";
          const price = trade || field.key === "rrp_price_cents";
          const differences = differingSpecificationCells(products, field.key);
          return <tr key={field.key} data-trade-sensitive={trade ? "" : undefined} className={`border-b border-border/60 ${trade ? "comparator-trade-row" : ""}`}>
            <th scope="row" className="py-5 pl-3 pr-4 text-left align-top font-body text-[10px] font-bold uppercase tracking-[0.14em] leading-relaxed text-foreground/70">{field.label}</th>
            {products.map((product, index) => {
              const value = product ? product[field.key as keyof TradeProduct] : null;
              const text = typeof value === "string" && value.trim() ? value : "—";
              return <td key={product?.id ?? `${field.key}-${index}`} data-spec-different={differences[index] ? "" : undefined} className={`break-words px-3 py-5 text-left align-top font-body text-sm leading-relaxed text-foreground ${price ? "tabular-nums" : ""} ${trade ? "font-semibold" : "font-normal"} ${differences[index] ? "bg-muted/50" : ""}`}>
                {differences[index] && <span className="sr-only">Different across selected products: </span>}
                {price ? renderPrice(product, trade) : field.key === "designer_notes" ? (product && renderNote ? renderNote(product) : "—") : field.key === "materials" && product ? <ComparatorMaterialSwatches materials={text === "—" ? "" : text} linked={swatches?.get(product.id)} loading={swatchesLoading} /> : field.key === "dimensions" && product ? <ComparatorDimensions dimensions={text === "—" ? "" : text} /> : <span className="whitespace-pre-line">{text}</span>}
              </td>;
            })}
          </tr>;
        })}
      </tbody>
    </table>
  </div>}
  </div>;
}
