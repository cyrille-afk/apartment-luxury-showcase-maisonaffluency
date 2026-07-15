import { defineMcp } from "@lovable.dev/mcp-js";
import searchCuratorPicks from "./tools/search-curator-picks";
import getProduct from "./tools/get-product";

// Public MCP server for Maison Affluency's designer catalog.
//
// Unauthenticated on purpose: exposes only the anon-safe curator-picks view
// (`designer_curator_picks_public`), which already restricts to published,
// non-trade-only designers via its own RLS policy. Trade net pricing, tearsheet
// PDFs, CAD assets, favorites, quotes, and any user-specific data remain
// gated behind trade registration on maisonaffluency.com.
//
// Every response includes a `product_url` deep link back to the site so this
// server doubles as a discovery / acquisition channel for external AI clients
// (ChatGPT, Claude, Cursor, designer-owned assistants).
export default defineMcp({
  name: "maison-affluency-catalog",
  title: "Maison Affluency Catalog",
  version: "0.1.0",
  instructions:
    "Public catalog of collectible design and haute décor curated by Maison Affluency. Use `search_curator_picks` to discover pieces by designer, category, subcategory, materials, or free-text query. Use `get_product` to fetch the full public specification for a single curator pick. Prices are always 'Price on Request'; trade net pricing, tearsheet PDFs, and CAD files are available only to signed-in trade members on maisonaffluency.com.",
  tools: [searchCuratorPicks, getProduct],
});
