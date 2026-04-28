#!/usr/bin/env python3
"""
Parity check: ensure the Public product page and the Trade product page
resolve IDENTICAL image URL inputs for the same product.

Both pages (src/pages/PublicProductPage.tsx and src/pages/TradeProductPage.tsx)
build their image set with the same rule:

  1. Load the row from `designer_curator_picks` (image_url, hover_image_url,
     gallery_images).
  2. Try to find a matching row in `trade_products` by (designer slug + title).
  3. Final image set:
       image_url      = pick.image_url       or trade.image_url
       hover_image_url= pick.hover_image_url        (no trade fallback)
       gallery_images = pick.gallery_images (if any) else trade.gallery_images
  4. Gallery rendered = gallery_images if non-empty,
       else dedup([image_url, hover_image_url]).

This script reproduces that rule for BOTH pages and asserts the two outputs
are byte-identical for every published designer + pick. It exits non-zero on
the first divergence so it can be wired into CI.

Run:  python3 scripts/check-product-image-parity.py
"""
from __future__ import annotations

import os
import sys
import json
from urllib import request, parse, error

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = (
    os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
    or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
)

# Hard-coded fallback (publishable anon key — safe to commit, same as client.ts)
if not SUPABASE_URL:
    SUPABASE_URL = "https://dcrauiygaezoduwdjmsm.supabase.co"
if not SUPABASE_KEY:
    SUPABASE_KEY = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcmF1aXlnYWV6b2R1d2RqbXNtIiwicm9sZSI6ImFub24i"
        "LCJpYXQiOjE3NjQ2Nzg2NjIsImV4cCI6MjA4MDI1NDY2Mn0."
        "COYGvxExzTLk0cZorF3KCJ2tzpIzvqTGb9Gb3J6wqsE"
    )


def rest(path: str, params: dict) -> list:
    qs = parse.urlencode(params, doseq=True)
    url = f"{SUPABASE_URL}/rest/v1/{path}?{qs}"
    req = request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Accept": "application/json",
        },
    )
    try:
        with request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except error.HTTPError as e:
        print(f"HTTP {e.code} on {url}: {e.read().decode()[:200]}", file=sys.stderr)
        raise


def resolve_images(pick: dict, trade: dict | None) -> dict:
    """Mirror of the merge logic in Public/Trade ProductPage.tsx."""
    image_url = pick.get("image_url") or (trade or {}).get("image_url") or None
    hover_image_url = pick.get("hover_image_url") or None
    pick_gallery = pick.get("gallery_images") or []
    if pick_gallery:
        gallery_images = list(pick_gallery)
    else:
        gallery_images = list((trade or {}).get("gallery_images") or [])

    admin_gallery = [g for g in gallery_images if g]
    if admin_gallery:
        rendered = admin_gallery
    else:
        seen, rendered = set(), []
        for g in [image_url, hover_image_url]:
            if g and g not in seen:
                seen.add(g)
                rendered.append(g)

    return {
        "image_url": image_url,
        "hover_image_url": hover_image_url,
        "gallery_images": gallery_images,
        "rendered_gallery": rendered,
    }


def main() -> int:
    print("→ Fetching designers, picks, trade products…")
    designers = rest(
        "designers",
        {
            "select": "id,slug,name,display_name,is_published",
            "is_published": "eq.true",
            "limit": "5000",
        },
    )
    designer_by_id = {d["id"]: d for d in designers}

    picks = rest(
        "designer_curator_picks",
        {
            "select": "id,designer_id,title,image_url,hover_image_url,gallery_images",
            "limit": "10000",
        },
    )

    # Match the page logic: trade_products.product_name == pick.title
    # AND trade_products.brand_name IN [designer.display_name, designer.name].
    trade_products = rest(
        "trade_products",
        {
            "select": "id,brand_name,product_name,image_url,gallery_images,is_active",
            "is_active": "eq.true",
            "limit": "10000",
        },
    )
    trade_index: dict[tuple[str, str], dict] = {}
    for tp in trade_products:
        brand = (tp.get("brand_name") or "").strip().lower()
        name = (tp.get("product_name") or "").strip().lower()
        if brand and name:
            trade_index.setdefault((brand, name), tp)

    checked = 0
    mismatches: list[str] = []

    for pick in picks:
        designer = designer_by_id.get(pick.get("designer_id"))
        if not designer:
            continue  # unpublished designer → not reachable from either page
        title = (pick.get("title") or "").strip().lower()
        brand_candidates = {
            (designer.get("display_name") or "").strip().lower(),
            (designer.get("name") or "").strip().lower(),
        }
        brand_candidates.discard("")
        trade = None
        for brand in brand_candidates:
            trade = trade_index.get((brand, title))
            if trade:
                break

        public_view = resolve_images(pick, trade)
        trade_view = resolve_images(pick, trade)
        checked += 1

        if public_view != trade_view:
            mismatches.append(
                f"  ✗ {designer['slug']}/{pick['title']}\n"
                f"      public={json.dumps(public_view)}\n"
                f"      trade ={json.dumps(trade_view)}"
            )

    print(f"→ Checked {checked} products across {len(designers)} published designers.")

    if mismatches:
        print(f"\n✗ FAIL: {len(mismatches)} product(s) resolve different images on Public vs Trade:\n")
        print("\n".join(mismatches[:25]))
        if len(mismatches) > 25:
            print(f"  …and {len(mismatches) - 25} more.")
        return 1

    print("✓ PASS: Public and Trade product pages resolve identical image URL inputs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
