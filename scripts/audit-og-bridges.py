#!/usr/bin/env python3
"""
OG Bridge Audit Script — Run before publishing.

Checks every OG bridge HTML file for:
  1. Required og:image, og:title, og:url meta tags
  2. Bot-detection guard (prevents redirect for crawlers)
  3. og:image URL returns HTTP 200 with image content-type
  4. Self-referencing og:url
  5. og:updated_time for cache busting

Usage:
  python scripts/audit-og-bridges.py
  python scripts/audit-og-bridges.py --check-images
  python scripts/audit-og-bridges.py --warnings
"""

import os, re, sys, argparse
from html.parser import HTMLParser


class OGParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.og = {}
        self.twitter = {}
        self.has_bot_check = False
        self.has_redirect = False

    def handle_starttag(self, tag, attrs):
        if tag == "meta":
            d = dict(attrs)
            prop = d.get("property", "")
            name = d.get("name", "")
            content = d.get("content", "")
            if prop.startswith("og:"):
                self.og[prop] = content
            if name.startswith("twitter:"):
                self.twitter[name] = content

    def handle_data(self, data):
        if "window.location.replace" in data:
            self.has_redirect = True
        if re.search(r"!/bot\|crawl\|spider", data, re.I):
            self.has_bot_check = True


REQUIRED_OG = ["og:title", "og:image", "og:url", "og:site_name"]
RECOMMENDED_OG = ["og:description", "og:image:width", "og:image:height", "og:updated_time"]


def audit_file(filepath, check_images=False):
    issues = []
    warnings = []

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    parser = OGParser()
    try:
        parser.feed(content)
    except Exception as e:
        issues.append(f"HTML parse error: {e}")
        return issues, warnings

    for tag in REQUIRED_OG:
        if tag not in parser.og or not parser.og[tag].strip():
            issues.append(f"Missing required {tag}")

    for tag in RECOMMENDED_OG:
        if tag not in parser.og:
            warnings.append(f"Missing recommended {tag}")

    if parser.has_redirect and not parser.has_bot_check:
        issues.append(
            "CRITICAL: Has redirect but NO bot-detection guard — crawlers will miss OG tags"
        )

    if not parser.has_redirect:
        warnings.append("No redirect script (humans won't be sent to SPA)")

    if "twitter:card" not in parser.twitter:
        warnings.append("Missing twitter:card meta tag")

    if "og:image" in parser.og and check_images:
        import urllib.request, urllib.error

        img_url = parser.og["og:image"]
        try:
            req = urllib.request.Request(
                img_url, method="HEAD", headers={"User-Agent": "WhatsApp/2.24.0"}
            )
            resp = urllib.request.urlopen(req, timeout=15)
            ct = resp.headers.get("Content-Type", "")
            if not ct.startswith("image/"):
                issues.append(f"og:image returns non-image Content-Type: {ct}")
        except urllib.error.HTTPError as e:
            issues.append(f"og:image returns HTTP {e.code}: {img_url}")
        except Exception as e:
            issues.append(f"og:image fetch failed: {e}")

    if "og:url" in parser.og:
        og_url = parser.og["og:url"]
        basename = os.path.basename(filepath)
        if basename not in og_url:
            warnings.append(
                f"og:url may not be self-referencing (file: {basename}, og:url: {og_url})"
            )

    return issues, warnings


def main():
    ap = argparse.ArgumentParser(description="Audit OG bridge HTML files")
    ap.add_argument("--check-images", action="store_true", help="HEAD-check og:image URLs")
    ap.add_argument("--warnings", action="store_true", help="Show warnings too")
    args = ap.parse_args()

    public_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")

    files = []
    for root, dirs, fnames in os.walk(public_dir):
        for fn in sorted(fnames):
            if fn.endswith(".html") and ("og" in fn or "card" in fn or "share" in fn):
                files.append(os.path.join(root, fn))

    total_issues = 0
    files_with_issues = 0

    print(f"\n🔍 Auditing {len(files)} OG bridge files...\n")

    for fp in files:
        rel = os.path.relpath(fp, os.path.dirname(public_dir))
        issues, warnings = audit_file(fp, check_images=args.check_images)

        if issues or (args.warnings and warnings):
            print(f"{'❌' if issues else '⚠️ '} {rel}")
            for i in issues:
                print(f"    ❌ {i}")
                total_issues += 1
            if args.warnings:
                for w in warnings:
                    print(f"    ⚠️  {w}")
            if issues:
                files_with_issues += 1

    print(f"\n{'=' * 60}")
    print(f"📊 {len(files)} files scanned")
    print(f"   ✅ {len(files) - files_with_issues} OK")
    if files_with_issues:
        print(f"   ❌ {files_with_issues} files with {total_issues} error(s)")
    print()

    sys.exit(1 if total_issues > 0 else 0)


if __name__ == "__main__":
    main()