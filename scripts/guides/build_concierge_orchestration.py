"""Build the Concierge Multi-Step Orchestration roadmap PDF."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_template import build_guide  # noqa: E402

CFG = {
    "filename": "/mnt/documents/concierge-multi-step-orchestration.pdf",
    "title": "Concierge — Multi-Step Orchestration",
    "subtitle": "What is missing from the Trade AI Concierge to move it from a single-tool assistant to a brief-aware, multi-step orchestrator with a unified human-approval gate.",
    "running": "Concierge Roadmap — Multi-Step Orchestration",
    "sections": [
        {"title": "Where we are today", "blocks": [
            ("p", "The Trade Concierge currently exposes <b>two tools</b> to the model: <i>propose_tearsheet</i> and <i>add_to_tearsheet</i>. Every reply is a single-shot turn — the agent can either talk, or emit one tearsheet proposal card. Anything beyond curated selections (quotes, FF&amp;E, custom requests, samples, presentations) still requires the user to leave the chat and use the manual flows."),
            ("callout", "Bottom line",
                "We have a tasteful catalog-grounded recommender. We do not yet have an orchestrator that can take a brief, fan out across the platform, and present a reviewable plan."),
        ]},

        {"title": "1. New tools the agent should be able to call", "blocks": [
            ("table", [
                ("draft_quote", "Pre-fill a <i>trade_quotes</i> draft with line items (qty, lead time, currency, project_id) from a brief or from a tearsheet's picks."),
                ("add_to_quote", "Append items to an existing draft quote — twin of <i>add_to_tearsheet</i>, scoped to the user's open drafts."),
                ("propose_ffe_rows", "Generate FF&amp;E schedule rows for a project (room, qty, spec, lead time, budget band) ready for review."),
                ("draft_custom_request", "Open a <i>trade_custom_requests</i> draft when the brief implies bespoke work (COM, dimension changes, finish notes, target lead weeks)."),
                ("request_samples", "Pre-fill a sample request from the catalog matches discussed in the conversation."),
                ("draft_presentation", "Assemble a client-facing PDF / presentation from a chosen tearsheet, respecting white-label settings."),
            ]),
        ]},

        {"title": "2. Orchestration layer (currently missing)", "blocks": [
            ("h", "A. Brief intake / planner pass"),
            ("p", "Before fanning out to tools, run a structured extraction step: <i>project, room, style, budget band, lead-time ceiling, qty, client</i>. Today every turn is one-shot — there is no shared brief object to plan against."),
            ("h", "B. Multi-tool chaining in a single turn"),
            ("p", "The current stream interceptor processes the first tool call and stops. We need an inner loop that can run, e.g., <i>propose_tearsheet → draft_quote from the same picks → propose_ffe_rows for the project</i> and emit one combined plan card."),
            ("h", "C. Cross-turn state &amp; plan memory"),
            ("p", "Persist the working brief and the list of pending drafts on the conversation so step N+1 can reference what step N produced. Without this the agent forgets it just drafted a quote when the user says \"add the sconces too\"."),
            ("h", "D. Project + studio binding"),
            ("p", "Tools must accept and validate <i>project_id</i> (and inherit <i>studio_id</i>). Quotes and FF&amp;E are meaningless without a project; today the system prompt does not pass the active project context to the model."),
        ]},

        {"title": "3. Unified human-approval gate", "blocks": [
            ("p", "Today only tearsheet drafts render as a reviewable proposal card before commit. Every new tool needs the same review-and-amend pattern — nothing should write to the database without the user clicking <b>Approve</b>."),
            ("table", [
                ("Per-tool draft cards", "Quote draft, FF&amp;E rows, custom request, sample request, presentation — each rendered inline in chat with edit + approve + discard."),
                ("Unified Drafts tray", "A single panel listing all pending agent proposals across the conversation, so the user sees the full plan and can approve selectively."),
                ("Commit endpoint per draft", "Mirror of <i>trade-concierge-commit</i> — one route per draft type, all behind <i>auth.getClaims</i> with studio + project ownership checks."),
                ("Audit", "Every approved commit logs <i>who, what, when, source=concierge, plan_id</i> for traceability."),
            ]),
        ]},

        {"title": "4. Grounding gaps that will bite once tools land", "blocks": [
            ("table", [
                ("Pricing &amp; lead-time", "Catalog block fed to the model omits <i>trade_price_cents</i>, lead time and stock — quote drafts would be unpriced and undeliverable. Add these to the grounding payload."),
                ("Currency &amp; tier", "Drafted quotes must respect the user's default currency cascade and trade-tier discount, otherwise totals will diverge from the manual flow."),
                ("Project + studio scoping", "System prompt must inject the active project, the studio, and the studio's clients so the agent picks correct IDs."),
                ("Variant awareness", "For products with size_variants / variant_image_map, the agent must select a specific variant before drafting a line item."),
            ]),
        ]},

        {"title": "5. Suggested build order", "blocks": [
            ("p", "Smallest valuable increment first, each shippable on its own:"),
            ("table", [
                ("Step 1", "Add <i>project_id</i> + studio context to the concierge system prompt. No new tools yet — just makes existing tearsheets project-aware."),
                ("Step 2", "Extend grounding payload with price, lead time, stock, currency, tier discount."),
                ("Step 3", "Ship <i>draft_quote</i> + <i>add_to_quote</i> + a quote review card. Mirror the tearsheet commit pattern."),
                ("Step 4", "Add the brief-extraction planner pass and the inner multi-tool loop."),
                ("Step 5", "Ship <i>propose_ffe_rows</i> and the unified Drafts tray."),
                ("Step 6", "Add <i>draft_custom_request</i>, <i>request_samples</i>, <i>draft_presentation</i> as the long tail."),
            ]),
            ("callout", "Why this order",
                "Steps 1–2 are pure context plumbing and unblock everything downstream. Step 3 delivers the highest-ROI single feature (\"the concierge can pre-fill a quote\") without needing the planner. Steps 4–6 layer orchestration on top of proven tools."),
        ]},

        {"title": "Definition of done", "blocks": [
            ("p", "A trade user types: <i>\"Pull together a Mayfair townhouse drawing-room — French Art-Deco lean, sconces and a low table in burnished bronze, six chairs upholstered in mohair, lead time under twelve weeks.\"</i>"),
            ("p", "The concierge replies with <b>one combined plan card</b> showing: a tearsheet draft, a pre-filled quote bound to the user's <i>Mayfair Townhouse</i> project, FF&amp;E rows for the drawing-room, and a sample request for the mohair. The user reviews, amends quantities and finishes inline, clicks <b>Approve all</b>, and every artifact is committed under their studio with full audit. Nothing is written before that click."),
        ]},
    ],
}

if __name__ == "__main__":
    build_guide(**CFG)
    print("Built", CFG["filename"])
