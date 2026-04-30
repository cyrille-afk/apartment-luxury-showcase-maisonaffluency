#!/usr/bin/env python3
"""
Regenerate public/og-manifest.json so rescrape-og knows about every OG bridge.

Includes every .html file under public/ that has a <meta property="og:image">
tag — root level, plus designers/, ateliers/, gallery/, journal/, collectibles/.

Excludes index.html and obvious non-bridge files.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OG_TAG = re.compile(r'<meta\s+property="og:image"\s+content=', re.IGNORECASE)
EXCLUDE_NAMES = {"index.html", "404.html"}


def has_og(path: Path) -> bool:
    try:
        return bool(OG_TAG.search(path.read_text(encoding="utf-8", errors="ignore")))
    except Exception:
        return False


def main() -> None:
    paths: list[str] = []
    for p in sorted(PUBLIC.rglob("*.html")):
        if p.name in EXCLUDE_NAMES:
            continue
        rel = p.relative_to(PUBLIC).as_posix()
        if not has_og(p):
            continue
        paths.append(rel)

    out = PUBLIC / "og-manifest.json"
    out.write_text(json.dumps(paths, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} with {len(paths)} entries")


if __name__ == "__main__":
    main()
