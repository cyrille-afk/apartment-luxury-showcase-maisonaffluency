"""
Build the published Maison Affluency Studio Guides.

All visual styling lives in `brand_template.py`. This file is content-only:
adding a new guide is just appending a dict and calling `build_guide(**cfg)`.
"""
import os
import sys

# Allow running as a plain script: `python scripts/guides/build_guides.py`
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from brand_template import build_guide  # noqa: E402


SHARED_FILTERS = {
    "filename": "public/guides/studio-shared-filters.pdf",
    "title": "Working as a studio in the Trade Portal",
    "subtitle": "Shared project & designer filters, focus-aware navigation, and best practices for multi-user design studios.",
    "running": "Studio Guide — Shared Filters & Multi-User Workflow",
    "sections": [
        {"title": "How filters flow across the portal", "blocks": [
            ("p", "The Trade Portal uses two cross-page filters that bind your work to a single design context: a <b>Project</b> and a <b>Designer</b>. They are read from the URL on every page (<i>?project=…&amp;designer=…</i>) so that any view you open — Quotes, Project Folders, Tearsheets, the Project Hub — shows only what is relevant to that context."),
            ("h", "Where each filter lives"),
            ("table", [
                ("Project filter", "Persisted in your browser <i>session</i>. Survives navigation between Quotes, Boards and Tearsheets so you don't have to re-pick it on every page. Cleared on sign-out or when you explicitly remove it."),
                ("Designer filter", "URL-only, per-page. It scopes the current list to a single designer or atelier, but does not persist when you close the tab."),
                ("Active Filter Chips", "A shared header strip appears on the Project Hub, Quotes and Boards whenever a filter is active. Each chip is removable; \"Clear all\" wipes both at once (with confirmation)."),
            ]),
            ("callout", "Why this matters for studios",
                "Every team member who opens a deep link inherits the same filter context. Send a colleague <i>/trade/quotes?project=PROJ_ID&amp;designer=Studio+Name</i> and they land on the exact slice you were looking at — no walkthrough required."),
        ]},
        {"title": "Keyboard &amp; accessibility behaviour", "blocks": [
            ("p", "The filter chips are designed to be fully operable without a mouse — important for senior specifiers reviewing long boards, and for assistive-tech users."),
            ("table", [
                ("Tab", "Moves focus into the filter chip group."),
                ("‹ / ›", "Moves focus between chip clear buttons and the \"Clear all\" action. Wraps at the ends."),
                ("Home / End", "Jumps to the first / last clear control."),
                ("Enter / Space", "Activates the focused control. \"Clear all\" prompts for confirmation."),
                ("Focus restoration", "After clearing a single chip, focus moves to the remaining chip. After \"Clear all\" or the last remaining chip, focus returns to the filter region itself so screen readers announce the new state."),
                ("Live region", "Each clear is announced politely — e.g. \"Project Maison Riviera filter cleared\" — without stealing focus."),
            ]),
        ]},
        {"title": "Working as a multi-user studio", "blocks": [
            ("p", "Most Maison Affluency accounts now serve studios with multiple specifiers, procurement leads and principals. The patterns below help your team operate with one source of truth."),
            ("h", "A. One project, many seats"),
            ("p", "Create the project once from <b>Projects › New project</b>. The project ID becomes the anchor for every quote, board and tearsheet. Share the project URL with your team; the project filter will auto-restore on each colleague's session."),
            ("h", "B. Hand-offs via deep links"),
            ("p", "Instead of pasting screenshots, copy the URL of the page you're on. The shared filter encoding means the recipient lands on the same Quotes view, Board, or Tearsheet — pre-filtered by project and (optionally) designer."),
            ("h", "C. Designer scoping for procurement"),
            ("p", "When working through approvals brand-by-brand, layer the designer filter on top of the project filter. Clear just the designer chip when you move on to the next atelier; the project context stays intact."),
            ("h", "D. Confirm before clearing both"),
            ("p", "\"Clear all\" requires confirmation in the multi-filter pages. This protects you from accidentally losing a curated project context mid-review — a common frustration on shared screens or during client calls."),
            ("callout", "Studio housekeeping tip",
                "If a senior reviewer needs a clean slate, bookmark the unfiltered page (e.g. <i>/trade/quotes</i>) separately from the filtered deep link. Both can coexist in your team's shared bookmarks bar."),
        ]},
        {"title": "URL cheat sheet", "blocks": [
            ("table", [
                ("/trade/projects/&lt;id&gt;", "Project Hub for that project, with chips active."),
                ("/trade/quotes?project=&lt;id&gt;", "Quote list scoped to the project."),
                ("/trade/quotes?project=&lt;id&gt;&amp;designer=&lt;name&gt;", "Quotes for one designer inside one project."),
                ("/trade/boards?project=&lt;id&gt;", "Project folders for that project."),
                ("/trade/tearsheets?project=&lt;id&gt;", "Tearsheet builder pre-loaded with the project's picks."),
            ]),
            ("p", "<i>Need help rolling this out across your team? Reach out to your Maison Affluency contact — we're happy to run a short walkthrough.</i>"),
        ]},
    ],
}

FFE = {
    "filename": "public/guides/studio-ffe-schedule.pdf",
    "title": "The FF&amp;E Schedule",
    "subtitle": "Building, exporting and presenting Furniture, Fixtures &amp; Equipment schedules from the Trade Portal.",
    "running": "Studio Guide — FF&E Schedule",
    "sections": [
        {"title": "What the FF&amp;E Schedule is for", "blocks": [
            ("p", "The FF&amp;E Schedule (<i>/trade/ffe-schedule</i>) is your single source of truth for everything specified on a project — every chair, sconce, rug, joinery item — with quantities, lead times, trade pricing and status. It pulls automatically from your project's quotes, boards and tearsheets so you never re-key data."),
            ("h", "Three things it replaces"),
            ("table", [
                ("Spreadsheets", "No more parallel Excel files drifting out of sync with the portal. The schedule is the live view of what is actually quoted and approved."),
                ("Status emails", "Each line carries a status (Specified, Quoted, Approved, Ordered, Delivered) so principals can scan progress without a stand-up."),
                ("Manual totals", "Subtotals by room, by designer and by project roll up automatically, in the project currency."),
            ]),
            ("callout", "Why the auto-population matters",
                "The schedule reads from the same project context as your Quotes and Boards. Add a piece to a board with the project filter active and it appears on the schedule on next load — no duplicate entry, no reconciliation."),
        ]},
        {"title": "Filling out a schedule line", "blocks": [
            ("p", "Each line begins as a draft auto-created from a quote or board item. From there, your team enriches it with project-specific information."),
            ("table", [
                ("Room / Area", "Free text, with auto-suggest from rooms used elsewhere in the project. Drives the room subtotals."),
                ("Quantity", "Defaults to 1; change per-line. Rolls into trade-price totals."),
                ("Finish / Variant", "Captures the finish, fabric or size variant chosen — important when the parent product has multiple SKUs."),
                ("Lead time", "Inherited from the product where known; editable per project."),
                ("Status", "Specified › Quoted › Approved › Ordered › Delivered. Drives the colour-coded status pill."),
                ("Notes", "Internal notes for procurement (e.g. \"client to confirm leg finish before 12 May\")."),
            ]),
        ]},
        {"title": "Exporting and sharing the schedule", "blocks": [
            ("h", "PDF export"),
            ("p", "The PDF export carries the project header, room subtotals and a status legend. It is suitable for client reviews and for issuing to procurement partners. Pricing columns can be hidden for client-facing exports."),
            ("h", "CSV export"),
            ("p", "The CSV export contains every column, including SKUs and unit pricing — built for import into your studio's project management or accounting system."),
            ("h", "Live deep link"),
            ("p", "For internal stakeholders, share the URL: <i>/trade/ffe-schedule?project=&lt;id&gt;</i>. They will see the live schedule with the same project filter applied, including any updates since the last export."),
            ("callout", "Versioning &amp; sign-off",
                "When a client signs off on a schedule, generate a dated PDF export and store it in the project folder. The portal continues to evolve; the PDF is your point-in-time record."),
        ]},
        {"title": "Best practice for studios", "blocks": [
            ("h", "A. One schedule per project"),
            ("p", "Avoid splitting a single project across multiple schedules. If a residence has several wings, use the Room field to segment instead — the room subtotals do the rest."),
            ("h", "B. Keep status honest"),
            ("p", "The colour-coded status is what principals scan. Move items to <b>Approved</b> only when they truly are; downstream order timeline forecasts depend on it."),
            ("h", "C. Use notes for client-facing language"),
            ("p", "Procurement notes are internal. For anything the client should see on the export, add it to the line description — exports respect description but hide internal notes."),
        ]},
    ],
}

TEARSHEETS = {
    "filename": "public/guides/studio-tearsheets.pdf",
    "title": "Building a Tearsheet",
    "subtitle": "Assembling client-ready, one-page specification tearsheets from curator picks and trade products.",
    "running": "Studio Guide — Tearsheets",
    "sections": [
        {"title": "What a tearsheet is", "blocks": [
            ("p", "A tearsheet is a one-page, client-ready specification document for a single piece — a chair, lamp, console — that combines the hero image, materials, dimensions, lead time and your studio's framing of why it belongs in the project. The Tearsheet Builder (<i>/trade/tearsheets</i>) generates these in seconds from any product in the portal."),
            ("h", "When to issue one"),
            ("table", [
                ("Client review", "Before a board meeting, when you want one piece to stand on its own."),
                ("Procurement", "When sending a single item to a sub-contractor or installer who doesn't need the full schedule."),
                ("Substitution", "When proposing an alternative to a previously approved piece, side-by-side with the original."),
            ]),
            ("callout", "Tearsheet vs. spec sheet",
                "A <b>spec sheet</b> is the manufacturer's technical document (dimensions, certifications, finish codes). A <b>tearsheet</b> is your studio's curated framing of that piece for the client. Both have a place; they are not interchangeable."),
        ]},
        {"title": "Building one in the portal", "blocks": [
            ("p", "Open any product, curator pick or board item and click <b>Generate tearsheet</b>. The builder pre-fills hero image, title, materials, dimensions, lead time and trade price from the source record."),
            ("table", [
                ("Hero image", "Defaults to the primary product image. Swap to a lifestyle shot from the gallery if the room context is more useful for the client."),
                ("Project framing", "A short paragraph in your studio's voice — why this piece, in this room, for this client. This is the only field you must write yourself."),
                ("Materials &amp; dimensions", "Inherited from the product record; editable per tearsheet (e.g. when you've specified a custom finish)."),
                ("Lead time", "Inherited from the product, then per-project override if the brand has quoted a different schedule."),
                ("Pricing", "Trade price is shown by default. Hide pricing for client-facing exports if your fee model is fixed."),
            ]),
        ]},
        {"title": "Layout and branding", "blocks": [
            ("h", "Studio header"),
            ("p", "Each tearsheet PDF carries the Maison Affluency wordmark in the footer and your project header at the top. The body of the page is yours: hero image left, copy right, dimensioning beneath."),
            ("h", "Cover style options"),
            ("p", "Choose between the editorial (jade header) and minimal (cream) cover styles when bundling multiple tearsheets into a presentation deck. The editorial style aligns with the rest of the portal's print collateral."),
            ("callout", "When to white-label",
                "Tearsheets respect the white-label policy: brand-specific manufacturer branding is suppressed in favour of the piece, materials and your studio's framing. The client sees the work, not the supply chain."),
        ]},
        {"title": "Bundling tearsheets into a deck", "blocks": [
            ("p", "From the Presentation Builder (<i>/trade/presentations</i>), drop multiple tearsheets into a single deck — by room, by designer, or as a substitution comparison."),
            ("h", "Recommended sequence"),
            ("table", [
                ("1.  Cover", "Project name, client name, date, and a single hero image."),
                ("2.  Concept", "One short paragraph framing the room or scheme."),
                ("3.  Tearsheets", "Grouped by room. Within a room, lead with the anchor piece (sofa, dining table) before accents."),
                ("4.  Schedule summary", "A single page summarising room subtotals from the FF&amp;E Schedule."),
                ("5.  Next steps", "Approvals required, lead-time-critical items, target dates."),
            ]),
        ]},
        {"title": "Studio patterns we recommend", "blocks": [
            ("h", "A. Write the framing once, reuse it"),
            ("p", "If a piece appears on multiple tearsheets across projects, save the framing paragraph as a snippet. Edit per-project rather than re-writing from scratch."),
            ("h", "B. Lead with the image"),
            ("p", "Clients respond to the photography first. Choose the hero shot that best reads at A4 size — busy lifestyle shots can compete with the spec content."),
            ("h", "C. Keep dimensions metric and imperial"),
            ("p", "For international clients, the builder shows both. Don't strip imperial unless you've confirmed your client doesn't need it."),
            ("callout", "One last check",
                "Before issuing, preview the PDF at 100%. Tearsheets read very differently in the browser thumbnail vs. on a printed A4 page in a client's hands."),
        ]},
    ],
}


GUIDES = (SHARED_FILTERS, FFE, TEARSHEETS)


if __name__ == "__main__":
    for cfg in GUIDES:
        path = build_guide(**cfg)
        print("built", path)
