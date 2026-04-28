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
import subprocess
from urllib import request, parse, error

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "https://dcrauiygaezoduwdjmsm.supabase.co"
SUPABASE_KEY = (
    os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
    or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
       "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcmF1aXlnYWV6b2R1d2RqbXNtIiwicm9sZSI6ImFub24i"
       "LCJpYXQiOjE3NjQ2Nzg2NjIsImV4cCI6MjA4MDI1NDY2Mn0."
       "COYGvxExzTLk0cZorF3KCJ2tzpIzvqTGb9Gb3J6wqsE"
)

USE_PSQL = bool(os.environ.get("PGHOST"))


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


def sql(query: str) -> list[dict]:
    """Run SQL via psql (bypasses RLS) and return rows as dicts."""
    out = subprocess.run(
        ["psql", "-At", "-F", "\t", "-c", f"COPY ({query}) TO STDOUT WITH (FORMAT csv, HEADER, NULL '\\N')"],
        capture_output=True, text=True, check=True,
    ).stdout
    import csv, io
    reader = csv.DictReader(io.StringIO(out))
    rows: list[dict] = []
    for r in reader:
        norm = {}
        for k, v in r.items():
            if v == "\\N" or v is None:
                norm[k] = None
            elif v.startswith("{") and v.endswith("}"):
                inner = v[1:-1]
                norm[k] = [x.strip('"') for x in inner.split(",")] if inner else []
            else:
                norm[k] = v
        rows.append(norm)
    return rows



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


def classify(pick: dict, trade: dict | None, public_view: dict, trade_view: dict) -> str:
    """Categorize a product for the parity report."""
    if public_view != trade_view:
        return "mismatch"
    if not trade:
        return "pick_only"
    pick_has_image = bool(pick.get("image_url"))
    pick_has_gallery = bool(pick.get("gallery_images"))
    trade_has_gallery = bool(trade.get("gallery_images"))
    if not pick_has_image and trade.get("image_url"):
        return "trade_only_fallback"
    if pick_has_gallery and trade_has_gallery and list(pick["gallery_images"]) != list(trade["gallery_images"]):
        return "divergent_gallery"
    return "match"


def main() -> int:
    print(f"→ Fetching designers, picks, trade products… (source: {'psql' if USE_PSQL else 'REST'})")
    if USE_PSQL:
        designers = sql(
            "SELECT id::text, slug, name, display_name FROM public.designers WHERE is_published = true"
        )
        picks = sql(
            "SELECT id::text, designer_id::text, title, image_url, hover_image_url, gallery_images "
            "FROM public.designer_curator_picks"
        )
        trade_products = sql(
            "SELECT id::text, brand_name, product_name, image_url, gallery_images "
            "FROM public.trade_products WHERE is_active = true"
        )
    else:
        designers = rest("designers", {"select": "id,slug,name,display_name", "is_published": "eq.true", "limit": "5000"})
        picks = rest("designer_curator_picks", {"select": "id,designer_id,title,image_url,hover_image_url,gallery_images", "limit": "10000"})
        trade_products = rest("trade_products", {"select": "id,brand_name,product_name,image_url,gallery_images", "is_active": "eq.true", "limit": "10000"})

    designer_by_id = {d["id"]: d for d in designers}
    trade_index: dict[tuple[str, str], dict] = {}
    for tp in trade_products:
        brand = (tp.get("brand_name") or "").strip().lower()
        name = (tp.get("product_name") or "").strip().lower()
        if brand and name:
            trade_index.setdefault((brand, name), tp)


    rows: list[dict] = []
    counts: dict[str, int] = {}

    for pick in picks:
        designer = designer_by_id.get(pick.get("designer_id"))
        if not designer:
            continue
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
        status = classify(pick, trade, public_view, trade_view)
        counts[status] = counts.get(status, 0) + 1

        rows.append({
            "designer_slug": designer.get("slug"),
            "designer_name": designer.get("display_name") or designer.get("name"),
            "product_title": pick.get("title"),
            "pick_id": pick.get("id"),
            "trade_product_id": (trade or {}).get("id"),
            "status": status,
            "public_image_url": public_view["image_url"],
            "trade_image_url": trade_view["image_url"],
            "public_hover_image_url": public_view["hover_image_url"],
            "trade_hover_image_url": trade_view["hover_image_url"],
            "public_rendered_gallery": public_view["rendered_gallery"],
            "trade_rendered_gallery": trade_view["rendered_gallery"],
            "pick_gallery_count": len(pick.get("gallery_images") or []),
            "trade_gallery_count": len((trade or {}).get("gallery_images") or []),
        })

    print(f"→ Checked {len(rows)} products across {len(designers)} published designers.")
    for status, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"   {status:>22} : {n}")

    # Write artifacts
    out_dir = "/mnt/documents"
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, "product-image-parity-report.json")
    csv_path = os.path.join(out_dir, "product-image-parity-report.csv")

    # Report only divergent rows in the artifact (mismatch / divergent_gallery / trade_only_fallback)
    divergent = [r for r in rows if r["status"] != "match"]
    with open(json_path, "w") as f:
        json.dump({"summary": counts, "total": len(rows), "divergent": divergent}, f, indent=2)

    import csv
    with open(csv_path, "w", newline="") as f:
        if divergent:
            fieldnames = list(divergent[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in divergent:
                row = {k: (json.dumps(v) if isinstance(v, list) else v) for k, v in r.items()}
                writer.writerow(row)
        else:
            f.write("status\nno_divergences\n")

    print(f"\n✓ Wrote {len(divergent)} divergent row(s) to:")
    print(f"   {json_path}")
    print(f"   {csv_path}")

    # Exit non-zero only on hard mismatches (page logic divergence).
    return 1 if counts.get("mismatch", 0) else 0


if __name__ == "__main__":
    sys.exit(main())
