export interface ComparatorExportOptions {
  mode: "client" | "internal";
  retail: boolean;
  trade: boolean;
  logistics: boolean;
  materials: boolean;
}

export function defaultComparatorExportOptions(): ComparatorExportOptions {
  return { mode: "client", retail: true, trade: false, logistics: true, materials: true };
}

export function comparatorExportFields(options: ComparatorExportOptions, tradeAllowed: boolean) {
  return [
    ...(options.mode === "internal" ? [{ key: "brand_name", label: "Brand" }] : []),
    { key: "category", label: "Category" },
    ...(options.logistics ? [{ key: "dimensions", label: "Dimensions" }, { key: "lead_time", label: "Lead Time" }] : []),
    ...(options.materials ? [{ key: "materials", label: "Materials" }] : []),
    ...(options.mode === "internal" ? [{ key: "designer_notes", label: "Designer Notes" }] : []),
    ...(options.retail ? [{ key: "rrp_price_cents", label: "Retail Price" }] : []),
    ...(options.mode === "internal" && options.trade && tradeAllowed ? [{ key: "trade_price_cents", label: "Trade Price" }] : []),
  ];
}

export function comparatorExportValues(values: Record<string, string>, options: ComparatorExportOptions, tradeAllowed: boolean): Record<string, string> {
  return Object.fromEntries(comparatorExportFields(options, tradeAllowed).map(field => [field.key, values[field.key] ?? ""]));
}