## Goal
Add a small helper button in the trade AI Concierge composer that pre-fills the composer textarea with the 4-Block Ingestion Framework scaffold, so trade users can quickly structure spec-grade briefs (GCB or similar) without retyping the format.

## Scope
Frontend / presentation only. No changes to the concierge system prompt, edge function, or model behavior.

## Where
`src/components/trade/AIConcierge.tsx` — the composer row at lines ~2460–2497 (Paperclip attach button → textarea → Send button).

## UX
- Add a new icon button next to the Paperclip (before the textarea), using a `FileText`/`SquarePen`/`ListChecks` lucide icon (already imported: `FileText`).
- Label: `aria-label="Insert spec brief template"`, tooltip `title="Insert 4-block spec brief template"`.
- Style: matches the Paperclip button (`shrink-0 rounded-xl border border-border bg-muted/40 p-2 …`).
- Behavior on click:
  - If the textarea already has non-whitespace content, append the template on a new line (preserve user text).
  - Otherwise set it to the template.
  - Then `setInput(...)` and refocus the textarea, moving caret to end.
  - Disabled while `streaming`.

## Template content
Neutral 4-block scaffold with placeholder brackets (not GCB-specific), so it's reusable for any project. Example:

```
Block 1 — Spatial & Project Context
PROJECT PROFILE: [typology, city/area]
ZONE: [room, ceiling height]
ENVIRONMENT: [humidity, sun exposure, glazing]
TIMELINE: Handover in [N] weeks (max lead time [N] weeks).

Block 2 — Hard Technical Parameters
TYPOLOGY: [e.g. sectional + accent chairs]
MAX FOOTPRINT: length ≤ [mm], depth ≤ [mm]
CLEARANCE: min [mm] perimeter pathway
MATERIALS: [performance criteria, exclusions]

Block 3 — Aesthetic & Visual DNA
VIBE: [e.g. Japandi-Luxe, Italian Minimalism]
REFERENCES: [Minotti / B&B Italia / Edra / …]
PALETTE: [materials + finishes]

Block 4 — Output Execution Protocol
Return 3 layout configurations. For every piece, output a strict Architectural Specification Schedule:
Product Name · Designer · Exact mm Dimensions · Verified Finish Options · Lead Time · Cloudinary image URL · Supabase CAD/BIM URL.
No conversational intro.
```

Store as a top-level `const SPEC_BRIEF_TEMPLATE` in the file.

## Out of scope
- No changes to system prompt, RAG, or model routing.
- No mobile-specific layout changes beyond the extra button (row already flex-wraps its inner controls; verify it still fits at mobile widths — if crowded, we can hide the label-only, keep icon).
- No persistence beyond the existing `sessionStorage("concierge:draft")` already wired to `input`.

## Verification
- Open `/trade/…` where AIConcierge mounts (floating widget), click the new button, confirm the textarea fills with the scaffold and focus returns to it.
- Click again with content present → template appended on new line.
- Sending works unchanged.
