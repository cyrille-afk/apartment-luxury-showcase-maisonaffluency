# Interactive Floor Plan Layout

A new admin trade page at `/trade/floor-plan` where you upload a floor plan, drag furniture from your catalog onto it, position/rotate items, and export a 2D top-down PDF with dimension annotations.

## User flow

1. Navigate to `/trade/floor-plan` (admin-only, same gating + logging as Axonometric Studio)
2. Upload a floor plan image (or pick one from `trade_floor_plans`)
3. Set scale: click two points on the plan, enter the real-world distance (e.g. "300 cm") — establishes px-per-cm
4. Browse catalog sidebar (search/filter `trade_products` + `designer_curator_picks`) showing product thumbnail + dimensions
5. Drag a product onto the canvas → it appears as a scaled top-down rectangle with the product name
6. Select an item to: move, rotate (R key / handle), resize is locked to real dimensions, delete (Del), duplicate
7. Toggle "Show dimensions" → overlays measurement lines along walls and between items
8. Save layout (persists to `trade_floor_plan_layouts`)
9. Export PDF: floor plan with furniture footprints + dimension annotations + legend (item #, name, brand, dimensions)

## Technical details

**Page:** `src/pages/TradeFloorPlan.tsx` — admin gate + unauthorized logging (reuse pattern from `TradeAxonometric.tsx`).

**Components:**
- `src/components/trade/floorplan/FloorPlanCanvas.tsx` — react-konva stage with: background image layer, furniture layer (draggable rectangles), dimension overlay layer, scale-calibration tool
- `src/components/trade/floorplan/CatalogSidebar.tsx` — searchable list of products with width/depth, drag source
- `src/components/trade/floorplan/PropertyPanel.tsx` — selected item: rotation slider, position inputs, delete, duplicate
- `src/components/trade/floorplan/ScaleCalibrator.tsx` — two-click + distance input modal
- `src/components/trade/floorplan/DimensionLayer.tsx` — auto-generates dimension lines (item-to-item, item-to-wall)
- `src/lib/floorplan/exportPdf.ts` — uses `jspdf` + konva `stage.toDataURL()` to compose PDF (plan image + items + dimensions + legend table)

**Data model (already exists):**
- `trade_floor_plans` (9 cols) — stores uploaded plan + scale metadata
- `trade_floor_plan_layouts` (7 cols) — stores `items: jsonb` array `[{product_id, x_cm, y_cm, rotation_deg, width_cm, depth_cm, label}]`

I'll verify columns and add any missing ones (e.g. `px_per_cm`, `calibration_points`) via migration if needed.

**Catalog source:** existing `useTradeProducts` / curator picks. Read dimensions from product `width_cm`, `depth_cm`, `height_cm` columns (fallback to parsing from spec string when missing).

**Libraries to add:** `react-konva`, `konva`, `jspdf`. (`use-gesture` already in stack.)

**Routing:** add to `src/App.tsx` routes and a tile on `/trade` next to Axonometric Studio.

**Out of scope for v1:** multi-floor, walls/door drawing, 3D preview, sharing link, client-board embed. Each can ship later.

## What I'll ship in this pass

1. DB check + migration if columns missing
2. Install deps
3. New page + 5 components + export util
4. Route + trade-home tile
5. Verify build, open preview, drag one item, export sample PDF, confirm dimensions render
