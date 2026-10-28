# Roadmap

## Presentation price protection
- [x] Align Presentation retail labels and typography across product prices and drawer summaries; signed-in ON/OFF verified four synchronized blocks with matching computed type/color, phone fit, unchanged URL, and 15 passing regressions.
- [x] Persist mode across product pages, drawer remounts and app reloads/resume; signed-in browser verified ON/OFF across two products and reloads, with drawer remount/resume covered by tests (13 regressions pass).
- [x] Add synchronized Presentation Mode controls beside product prices and at drawer headers.
- [x] Show retail-only client prices and omit trade values from presentation tearsheets and copied previews; unknown quote retail is Price upon Request, never relabelled net.
- [x] Verify live toggle round-trip and actual presentation print/PDF, including a presentation link opened with shared mode off; 20 regression tests pass.

## Trade order workspace
- [x] Align both restored drawers with active finishes and retail/net breakdown; signed-in Saint Honoré verified Teddy Mohair/Solid Oak, €20,500 retail/€18,450 net, and ON/OFF removes/restores net without closing or redirecting; 24 tests pass.
- [x] Handle unavailable-purchase 409 inline without throwing, preserve selections and offer an enquiry; exact response verified in signed-in checkout with no blank screen or provider-update errors.
- [x] Restore product-page order/workspace drawers without role selection or cart redirection; both Saint Honoré buttons verified signed in, with unchanged product URL and active details; 18 regression tests pass.
- [x] Bypass public onboarding for authenticated Trade Studio orders using the professional session and existing checkout flow.
- [x] Verify signed-in Saint Honoré order opens its configured basket with professional identity, no onboarding or browser errors; 11 tests cover Trade mobile/desktop and retained Public/Presentation intake.

## Admin price history
- [x] Persist editor save attempts in admin-only database records; verified failed/confirmed writes across independent sessions, atomic saved status and nine access checks without changing prices.
- [x] Add saved price history from the existing admin-only audit log, including variant changes.
- [x] Show current-session pending, failed and unconfirmed editor saves separately from confirmed history.
- [x] Verify price differences, admin access and the history view with real saved records.

## Technical SEO findings
- [x] Bound product titles and descriptions consistently in server and client metadata.
- [x] Add 44 canonical category/subcategory pages and public sign-in to the sitemap; preserve record-specific lastmod and abort incomplete reads.
- [x] Verify www domains, social previews, crawler rules, single static-page titles, product pages and metadata; 20 regression tests pass.
- [x] Leave the collectible-design article suggestion unchanged (technical SEO only).
- [ ] Sitemap scanner verdict: remaining requests to index password recovery and retired registration are intentionally not implemented; recovery is noindex, registration redirects to the application page.

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
- [ ] Publish the technical SEO corrections; the live website still serves the previous page tags and sitemap.
