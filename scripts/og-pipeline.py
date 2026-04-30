#!/usr/bin/env python3
"""
OG Image Pipeline
=================

Ensures every designer OG bridge in public/designers/*.html points to an OG
image that is:

  • exactly 1200 × 630 px
  • <= 300 KB on the wire
  • served from a CDN we control (Supabase 'assets' bucket, og/ prefix)
    or already a Cloudinary URL with a 1200×630 fill transform.

Sources we leave UNTOUCHED (already compliant):
  - https://res.cloudinary.com/.../upload/.../w_1200,h_630,c_fill,...
  - https://<project>.supabase.co/storage/v1/object/public/assets/og/...

Anything else (hearstapps.com, brand sites, random CDNs, Wikipedia, etc.) is
downloaded, resized, recompressed under 300 KB, uploaded to the assets bucket
under og/<slug>.jpg and the bridge HTML is rewritten in place.

Usage:
  python3 scripts/og-pipeline.py                 # dry run (report only)
  python3 scripts/og-pipeline.py --apply         # do uploads + rewrite files
  python3 scripts/og-pipeline.py --only foo.html # process a single bridge
  python3 scripts/og-pipeline.py --url https://… --slug custom-name --apply
                                                 # one-off rehost without
                                                 # touching any file
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import re
import sys
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
BRIDGES_DIR = ROOT / "public" / "designers"

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://dcrauiygaezoduwdjmsm.supabase.co"
)
ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcmF1aXlnYWV6b2R1d2RqbXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Nzg2NjIsImV4cCI6MjA4MDI1NDY2Mn0.COYGvxExzTLk0cZorF3KCJ2tzpIzvqTGb9Gb3J6wqsE",
)
REHOST_ENDPOINT = f"{SUPABASE_URL}/functions/v1/og-rehost"

CLOUDINARY_OK = re.compile(
    r"https://res\.cloudinary\.com/.*/upload/[^/]*w_1200[^/]*h_630[^/]*c_fill",
    re.IGNORECASE,
)
SELF_HOSTED = re.compile(
    r"https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/assets/og/",
    re.IGNORECASE,
)
OG_TAG = re.compile(
    r'(<meta\s+(?:property|name)="(?:og:image(?::secure_url)?|twitter:image)"\s+content=")([^"]+)(")',
    re.IGNORECASE,
)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


# ---------- rehost (delegates heavy lifting to og-rehost edge function) ----------

def rehost_via_edge(source_url: str, slug: str) -> dict:
    r = requests.post(
        REHOST_ENDPOINT,
        json={"sourceUrl": source_url, "slug": slug},
        headers={
            "Authorization": f"Bearer {ANON_KEY}",
            "apikey": ANON_KEY,
            "Content-Type": "application/json",
        },
        timeout=120,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"og-rehost {r.status_code}: {r.text[:300]}")
    return r.json()


# ---------- bridge rewriting ----------

def needs_rehost(url: str) -> bool:
    if not url or url.startswith("data:"):
        return False
    if CLOUDINARY_OK.search(url):
        return False
    if SELF_HOSTED.search(url):
        return False
    return True


def slug_for(bridge_path: Path) -> str:
    base = bridge_path.stem  # e.g. apparatus-studio-og-v2
    # collapse any trailing -og or -og-vN; one slug per designer
    return re.sub(r"-og(?:-v\d+)?$", "", base)


def process_bridge(path: Path, apply: bool) -> dict:
    html = path.read_text(encoding="utf-8")
    images = {m.group(2) for m in OG_TAG.finditer(html)}
    if not images:
        return {"file": path.name, "status": "no-og-image"}

    # All og:image / twitter:image / og:image:secure_url should match each other.
    src = next(iter(images))
    if not needs_rehost(src):
        return {"file": path.name, "status": "ok", "src": src}

    if not apply:
        return {"file": path.name, "status": "would-rehost", "src": src}

    try:
        raw = fetch(src)
        out = fit_1200x630_under_300kb(raw)
        slug = slug_for(path, src)
        hosted = storage_put(slug, out)
        new_html = OG_TAG.sub(lambda m: m.group(1) + hosted + m.group(3), html)
        if new_html != html:
            path.write_text(new_html, encoding="utf-8")
        return {
            "file": path.name,
            "status": "rehosted",
            "src": src,
            "hosted": hosted,
            "bytes": len(out),
        }
    except Exception as exc:  # noqa: BLE001
        return {"file": path.name, "status": "error", "src": src, "error": str(exc)}


def iter_bridges(only: str | None) -> Iterable[Path]:
    if only:
        p = BRIDGES_DIR / only
        if not p.exists():
            sys.exit(f"no such bridge: {p}")
        yield p
        return
    yield from sorted(BRIDGES_DIR.glob("*.html"))


# ---------- one-off mode ----------

def one_off(url: str, slug: str) -> str:
    raw = fetch(url)
    out = fit_1200x630_under_300kb(raw)
    return storage_put(slug, out)


# ---------- main ----------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually upload + rewrite")
    ap.add_argument("--only", help="single bridge filename, e.g. foo-og-v2.html")
    ap.add_argument("--url", help="one-off mode: rehost a single URL")
    ap.add_argument("--slug", help="slug to use with --url (required)")
    args = ap.parse_args()

    if args.url:
        if not args.slug:
            sys.exit("--slug required with --url")
        print(one_off(args.url, args.slug))
        return

    counts = {"ok": 0, "would-rehost": 0, "rehosted": 0, "error": 0, "no-og-image": 0}
    for bridge in iter_bridges(args.only):
        res = process_bridge(bridge, apply=args.apply)
        counts[res["status"]] = counts.get(res["status"], 0) + 1
        if res["status"] in ("would-rehost", "rehosted", "error"):
            print(
                f"[{res['status']:>13}] {res['file']}"
                + (f"  ← {res.get('src','')[:80]}" if res.get("src") else "")
                + (f"  → {res['hosted']} ({res['bytes']} B)" if res.get("hosted") else "")
                + (f"  !! {res['error']}" if res.get("error") else "")
            )

    print("\nSummary:")
    for k, v in counts.items():
        print(f"  {k:>13}: {v}")


if __name__ == "__main__":
    main()
