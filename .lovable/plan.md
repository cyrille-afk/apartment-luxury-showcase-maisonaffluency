# BIM/CAD Reasoning Agent

Honest framing: "full spatial reasoning on DWG + DXF" is a 3-phase build, not one shot. DWG is a closed Autodesk format — no open-source parser produces reliable geometry from it. The realistic path is DXF natively + DWG via a server-side converter (LibreDWG or ODA File Converter on an edge worker), then layer spatial logic on top of the extracted geometry. I'll ship in phases so you see value after each.

## Architecture

```text
User uploads .dwg/.dxf
        │
        ▼
┌──────────────────────────┐
│ /trade/spatial-fit page  │  ← dedicated uploader + 2D viewer
│  OR concierge attachment │  ← same backend, invoked as tool
└──────────────────────────┘
        │ multipart upload
        ▼
Supabase Storage: cad-uploads/ (private, 60s signed URLs)
        │
        ▼
Edge Function: cad-parse
  - DXF: parse text directly (dxf-parser, npm)
  - DWG: convert → DXF via LibreDWG WASM, then parse
  - Extract: layers, blocks, polylines, rooms (closed polylines),
             ceiling heights (from text/attributes), doors, walls
  - Returns normalized JSON: rooms[], openings[], constraints
        │
        ▼
Supabase table: cad_documents (parsed geometry cached)
        │
        ▼
Edge Function: cad-spatial-reason (LLM + deterministic checks)
  - Input: room id + product id (or catalog filter)
  - Deterministic: bbox fit, clearance zones, door swing arcs,
                   ceiling clearance, sightlines
  - LLM layer: style/material match, suggest alternates,
               multi-product layout reasoning, conflict narration
        │
        ▼
Returned to UI:
  - 2D plan with product footprints overlaid
  - Per-room fit report (pass/warn/fail + reasons)
  - "Suggest alternates" CTA (queries catalog by dim constraints)
  - "Open as tearsheet" / "Open quote draft" (reuse existing flow)
```

## Phase 1 — Foundation (DXF + dimensional fit + concierge tool)

- New private Storage bucket `cad-uploads` with RLS (studio-scoped).
- New tables:
  - `cad_documents` (id, studio_id, user_id, file_path, format, parsed_geometry JSONB, status, error, created_at)
  - `cad_fit_reports` (id, cad_document_id, room_id, product_id, verdict, reasons JSONB, created_at)
- Edge function `cad-parse` — DXF only in phase 1, using `dxf-parser` (npm). Extracts rooms (closed LWPOLYLINE on layer matching `ROOM|SPACE|A-AREA`), text labels, basic openings.
- Edge function `cad-spatial-reason` — deterministic bbox/clearance only in phase 1, LLM narrates the result.
- `/trade/spatial-fit` page: uploader, room list with detected dims, "Check fit" against any catalog product or category.
- Concierge tool: `cad_check_fit({ cad_document_id, room_label, product_id? })` — returns same JSON, agent narrates.
- 2D viewer: simple SVG of room polygons + product footprint overlay (no full CAD renderer needed in phase 1).

## Phase 2 — DWG support + clearance/swing logic

- Add LibreDWG WASM (or shell out to ODA File Converter on a dedicated worker if WASM perf is poor) inside `cad-parse` to convert .dwg → .dxf in-function, then reuse phase 1 parser.
- Spatial rules: door swing arcs, walking clearance (≥600mm around seating, ≥900mm primary circulation), ceiling void clearance for pendants, sightline checks.
- Verdict upgraded to pass / warn / fail with structured reasons.

## Phase 3 — Multi-product layout + style/material match

- Concierge gets `cad_propose_layout({ cad_document_id, room_label, brief })` — agent calls catalog search + spatial checker in a loop, returns a draft FF&E for the room, opens tearsheet draft (reuses existing tearsheet builder).
- Style/material match: ceiling finish, wall finish, existing palette tags (parsed from DXF text/attributes or supplied by user) cross-referenced with curator pick material tags.
- "Compliance/spec validation" cross-link: lead time vs project deadline, budget vs RRP — surfaces as warnings in the same fit report (this is item #5 from the article, but slots in naturally here).

## What I need from you before coding

1. **Phase 1 scope confirmation** — ship phase 1 first (DXF + dimensional fit + concierge tool + dedicated page), get it working in production, then phase 2/3? Or do you want all three planned and stubbed up-front?
2. **DWG strategy** — LibreDWG WASM (free, ~10MB, sometimes flaky on complex files) vs an ODA File Converter worker (more reliable, requires hosting). Recommend WASM for phase 2 and only move to a worker if real files fail.
3. **Studio access** — you mentioned multi-user studios aren't fine-tuned yet. CAD uploads are per-user or per-studio-shared? Recommend per-studio-shared from day 1 (matches the "real account manager" framing).

You said "1/" — assuming more is coming. I'll wait for your follow-ups + the answers above before touching code.
