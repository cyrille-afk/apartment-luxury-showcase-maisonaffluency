import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TradeProduct } from "@/lib/tradeProducts";
import { differingSpecificationCells } from "@/lib/comparatorDifferences";

interface ComparisonField { key: string; label: string }
interface Props {
  products: (TradeProduct | null)[];
  fields: ComparisonField[];
  onRemove: (id: string) => void;
  renderPrice: (product: TradeProduct | null, net: boolean) => ReactNode;
}

function MaterialItems({ value }: { value: string }) {
  const items = value.split(/\r?\n|\s*[•·;]\s*/).map(item => item.trim()).filter(Boolean);
  return <ul className="space-y-2">
    {items.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2.5">
      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
      <span className="min-w-0">{item}</span>
    </li>)}
  </ul>;
}

export function ProductComparisonTable({ products, fields, onRemove, renderPrice }: Props) {
  return <div className="overflow-x-auto" role="region" aria-label="Product comparison" tabIndex={0}>
    <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
      <caption className="sr-only">Selected products, specifications and pricing</caption>
      <colgroup><col className="w-36" />{products.map((_, index) => <col key={index} />)}</colgroup>
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
          return <tr key={field.key} data-trade-sensitive={trade ? "" : undefined} className={`border-b border-border/60 ${trade ? "bg-muted/70" : ""}`}>
            <th scope="row" className="py-5 pl-3 pr-4 text-left align-top font-body text-[10px] font-bold uppercase leading-relaxed text-muted-foreground">{field.label}</th>
            {products.map((product, index) => {
              const value = product ? product[field.key as keyof TradeProduct] : null;
              const text = typeof value === "string" && value.trim() ? value : "—";
              return <td key={product?.id ?? `${field.key}-${index}`} data-spec-different={differences[index] ? "" : undefined} className={`break-words px-3 py-5 text-left align-top font-body text-sm leading-relaxed text-foreground ${price ? "tabular-nums" : ""} ${trade ? "font-semibold" : "font-normal"} ${differences[index] ? "bg-muted/50" : ""}`}>
                {differences[index] && <span className="sr-only">Different across selected products: </span>}
                {price ? renderPrice(product, trade) : field.key === "materials" && text !== "—" ? <MaterialItems value={text} /> : <span className="whitespace-pre-line">{text}</span>}
              </td>;
            })}
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}