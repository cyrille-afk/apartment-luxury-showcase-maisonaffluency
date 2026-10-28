# Roadmap

## Technical SEO findings
- [ ] Bound product titles and descriptions consistently in server and client metadata.
- [ ] Add canonical category/subcategory pages to the existing sitemap; preserve trustworthy lastmod and fail on incomplete reads.
- [ ] Verify domain, social previews, crawler rules and metadata against current output; update only fully resolved findings.
- [ ] Leave the collectible-design article suggestion unchanged (technical SEO only).

## Rename Pouenat -> Maison Pouenat (everywhere the brand is shown)

- [x] Database: guarded rename across designer profiles, parent-house labels, product
      listings, material library, downloadable catalogues, concierge designer list,
      product photo records, journal articles (founder "Henri Pouenat", web addresses,
      image filenames and page addresses untouched)
- [x] Static brand lists in `src/data/brandCategories.json`
- [x] Hardcoded homepage/atelier copy in `BrandsAteliers.tsx`, `FeaturedDesigners.tsx`
- [x] `DesignersHoverHero.tsx` founder-suffix suppression set
- [x] Admin/placeholder examples: `TradeDocumentsAdmin.tsx`, `TradeAdminSuppliers.tsx`,
      `StudioMemoryCard.tsx`
- [x] Assistant/tool descriptions: `src/lib/mcp/index.ts`, `src/lib/mcp/tools/search-curator-picks.ts`
- [x] `src/lib/brandNormalization.ts`: legacy "Pouenat" -> "Maison Pouenat" alias
- [x] Unit-test fixtures (`designerHierarchy`, `editionLabel`, `comparatorEditionLabel`)
- [x] Regenerate build outputs from the database: designers index, featured designers,
      catalogue manifest (the link-preview generator would also create 256 unrelated
      pages, so the 12 Pouenat link-previews were edited in place instead)
- [x] Hand-edited link-preview pages: `public/ateliers/pouenat-og*.html`,
      `public/journal/pouenat-ad-collector-ad100-design-2025-og.html`,
      `public/share/og/pouenat-*-og.html`
- [x] Concierge roster files + redeploy the concierge and MCP functions (4 deployed,
      178/178 functions reported started; the pre-deploy boot check fails sandbox-wide
      on a missing package cache, for ~60 functions I never touched)
- [x] Verify: designer directory, product page credit, comparator grouping, trade filter
      chips, search facets, link-preview titles, unit tests, build

## Waiting on the user

- [ ] Publish the preview so the renamed listings, directory and catalogue files go live
      (designer profile pages already read the database live).
- [ ] Sync the project to GitHub — the rename is not in the repository yet.
