import { useMemo, useState, type ReactNode } from "react";
import { comparatorFacets, matchesComparatorFacets, type ComparatorFacetKind, type ComparatorFacetSelection } from "@/lib/comparatorFacets";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TradeProduct } from "@/lib/tradeProducts";
import { differingSpecificationCells } from "@/lib/comparatorDifferences";
import { ComparatorMaterialSwatches } from "./ComparatorMaterialSwatches";
import { useComparatorSwatches } from "@/hooks/useComparatorSwatches";

interface ComparisonField { key: string; label: string }
interface Props {
  products: (TradeProduct | null)[];
  fields: ComparisonField[];
  onRemove: (id: string) => void;
  renderPrice: (product: TradeProduct | null, net: boolean) => ReactNode;
}

const FACET_LABELS: Record<ComparatorFacetKind, string> = { material: "Material", finish: "Finish", color: "Colour" };

export function ProductComparisonTable({ products: allProducts, fields, onRemove, renderPrice }: Props) {
  const { data: swatches, isLoading: swatchesLoading } = useComparatorSwatches(allProducts.flatMap(product => product ? [product.id] : []));
  const [selection, setSelection] = useState<ComparatorFacetSelection>({});
  const facetsById = useMemo(() => new Map(allProducts.flatMap(p => p ? [[p.id, comparatorFacets(p.materials as string | null, swatches?.get(p.id))] as const] : [])), [allProducts, swatches]);
  const options = useMemo(() => Object.fromEntries((Object.keys(FACET_LABELS) as ComparatorFacetKind[]).map(k => [k, [...new Set([...facetsById.values()].flatMap(f => f[k]))].sort()])) as Record<ComparatorFacetKind, string[]>, [facetsById]);
  const active = Object.values(selection).some(Boolean);
  const products = active ? allProducts.filter(p => p && matchesComparatorFacets(facetsById.get(p.id)!, selection)) : allProducts;
  const hasOptions = Object.values(options).some(o => o.length > 0);
  const labelColumnWidth = "11rem";
  const productColumnWidth = `calc((100% - ${labelColumnWidth}) / ${Math.max(products.length, 1)})`;
  return <div>
    {hasOptions && <div className="mb-6 flex flex-wrap items-end gap-4" role="group" aria-label="Filter compared products">
      {(Object.keys(FACET_LABELS) as ComparatorFacetKind[]).map(kind => options[kind].length > 0 && <label key={kind} className="flex flex-col gap-1.5">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/70">{FACET_LABELS[kind]}</span>
        <select value={selection[kind] ?? ""} onChange={e => setSelection(s => ({ ...s, [kind]: e.target.value || undefined }))} className="h-9 min-w-40 border border-border bg-background px-3 font-body text-sm text-foreground">
          <option value="">All</option>
          {options[kind].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>)}
      {active && <Button type="button" variant="ghost" size="sm" onClick={() => setSelection({})}>Clear filters</Button>}
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
            <div className="aspect-[4/5] w-full overflow-hidden bg-muted">
              {product?.image_url ? <img src={product.image_url} alt={product.product_name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center px-5 font-body text-xs font-normal text-muted-foreground">{product ? product.product_name : `Select product ${index + 1}`}</div>}
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
                {price ? renderPrice(product, trade) : field.key === "materials" && product ? <ComparatorMaterialSwatches materials={text === "—" ? "" : text} linked={swatches?.get(product.id)} loading={swatchesLoading} /> : <span className="whitespace-pre-line">{text}</span>}
              </td>;
            })}
          </tr>;
        })}
      </tbody>
    </table>
  </div>}
  </div>;
}
