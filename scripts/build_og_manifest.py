#!/usr/bin/env python3
"""Generate public/og-bridges-manifest.json — the source of truth the
og-bridge-audit edge function reads at runtime.

Run after adding/removing any *-og.html / *-card.html / *-share*.html
bridge in public/.

Usage: python3 scripts/build_og_manifest.py
"""
import os, json, sys

ROOT = "public"
out = []
for dirpath, _, files in os.walk(ROOT):
    for f in files:
        if not f.endswith(".html"):
            continue
        if any(p in f for p in ("-og.html", "-og-v2.html", "-og-v3.html",
                                "-card.html", "-share")):
            rel = os.path.relpath(os.path.join(dirpath, f), ROOT).replace("\\", "/")
            out.append(rel)
out.sort()
manifest_path = os.path.join(ROOT, "og-bridges-manifest.json")
with open(manifest_path, "w") as fp:
    json.dump({"generated": "auto", "count": len(out), "paths": out}, fp, indent=2)
print(f"wrote {len(out)} bridge paths → {manifest_path}", file=sys.stderr)
