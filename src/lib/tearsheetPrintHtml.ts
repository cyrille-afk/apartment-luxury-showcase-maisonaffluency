/**
 * Pure builder for the tearsheet print/PDF HTML.
 *
 * Extracted from `TradeTearsheets.tsx` so the exact document written into
 * `window.open(...)` and sent to `window.print()` can be unit-tested and
 * exported to a real PDF for E2E verification.
 *
 * The inputs are the same derived variables (`dimensionsDisplay`,
 * `materialsDisplay`, `leadTimeDisplay`) that drive the on-screen preview,
 * so parity between the two surfaces is guaranteed by construction.
 */

export type TearsheetPrintProduct = {
  brand_name?: string | null;
  product_name: string;
  category?: string | null;
  description?: string | null;
  image_url?: string | null;
  trade_price_cents?: number | null;
  currency?: string | null;
};

export type TearsheetPrintFinishes = {
  variant?: string | null;
  wood?: string | null;
  woodImg?: string | null;
  fabric?: string | null;
  fabricImg?: string | null;
};

export interface TearsheetPrintInput {
  selectedProduct: TearsheetPrintProduct;
  chosenFinishes: TearsheetPrintFinishes;
  dimensionsDisplay: string | null;
  materialsDisplay: string | null;
  leadTimeDisplay: string | null;
  /** Injectable for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

const esc = (s?: string | null) =>
  (s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function priceString(product: TearsheetPrintProduct): string {
  if (!product.trade_price_cents) return "Price Upon Request";
  const symbol =
    product.currency === "USD" ? "$" :
    product.currency === "GBP" ? "£" :
    product.currency === "SGD" ? "S$" : "€";
  return `${symbol}${(product.trade_price_cents / 100).toLocaleString()}`;
}

export function buildTearsheetPrintHtml(input: TearsheetPrintInput): string {
  const {
    selectedProduct,
    chosenFinishes,
    dimensionsDisplay,
    materialsDisplay,
    leadTimeDisplay,
    now = new Date(),
  } = input;

  const priceStr = priceString(selectedProduct);

  return `
      <html><head><title>Tearsheet - ${esc(selectedProduct.product_name)}</title>
      <style>
        body { font-family: 'Helvetica Neue', sans-serif; margin: 40px; color: #1a1a1a; }
        .header { border-bottom: 1px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 24px; }
        .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #666; }
        .name { font-size: 24px; margin: 4px 0 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 2px; }
        .value { font-size: 14px; }
        .img { max-width: 100%; max-height: 300px; object-fit: contain; border: 1px solid #eee; }
        .footer { margin-top: 40px; border-top: 1px solid #e5e5e5; padding-top: 16px; font-size: 10px; color: #999; }
      </style></head><body>
      <div class="header">
        <p class="brand">${esc(selectedProduct.brand_name)}</p>
        <h1 class="name">${esc(selectedProduct.product_name)}</h1>
        ${chosenFinishes.variant ? `<p class="brand" style="margin-top:6px">Variant · ${esc(chosenFinishes.variant)}</p>` : ""}
      </div>
      ${selectedProduct.image_url ? `<img class="img" src="${esc(selectedProduct.image_url)}" />` : ""}
      ${(chosenFinishes.fabric || chosenFinishes.wood) ? `
      <div style="margin-top:24px;border:1px solid #eee;padding:16px;border-radius:6px;background:#fafafa">
        <p class="label" style="margin-bottom:12px">Selected Finishes</p>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          ${chosenFinishes.wood ? `
            <div style="display:flex;gap:10px;align-items:center">
              ${chosenFinishes.woodImg ? `<img src="${esc(chosenFinishes.woodImg)}" style="width:56px;height:56px;object-fit:cover;border:1px solid #ddd;border-radius:4px" />` : ""}
              <div><p class="label">Base / Wood</p><p class="value">${esc(chosenFinishes.wood)}</p></div>
            </div>` : ""}
          ${chosenFinishes.fabric ? `
            <div style="display:flex;gap:10px;align-items:center">
              ${chosenFinishes.fabricImg ? `<img src="${esc(chosenFinishes.fabricImg)}" style="width:56px;height:56px;object-fit:cover;border:1px solid #ddd;border-radius:4px" />` : ""}
              <div><p class="label">Fabric</p><p class="value">${esc(chosenFinishes.fabric)}</p></div>
            </div>` : ""}
        </div>
      </div>` : ""}
      <div class="grid" style="margin-top:24px">
        <div><p class="label">Category</p><p class="value">${esc(selectedProduct.category) || "—"}</p></div>
        <div><p class="label">Dimensions</p><p class="value" style="white-space:pre-line">${esc(dimensionsDisplay) || "—"}</p></div>
        <div><p class="label">Materials</p><p class="value" style="white-space:pre-line">${esc(materialsDisplay) || "—"}</p></div>
        <div><p class="label">Lead Time</p><p class="value">${esc(leadTimeDisplay) || "—"}</p></div>
        <div><p class="label">Trade Price</p><p class="value">${esc(priceStr)}</p></div>
        ${selectedProduct.description ? `<div style="grid-column:1/3"><p class="label">Description</p><p class="value">${esc(selectedProduct.description)}</p></div>` : ""}
      </div>
      <div class="footer">
        <p>Generated by Maison Affluency Trade Portal · ${esc(now.toLocaleDateString())}</p>
      </div>
      </body></html>
    `;
}
