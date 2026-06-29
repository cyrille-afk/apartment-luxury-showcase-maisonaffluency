# Visual Regression Snapshots

First time on a new machine, install the Playwright Chromium binary:

```bash
npx playwright install chromium
```

Then run from the project root with the dev server running on `http://localhost:8080`:


```bash
# First time (or after intentional UI changes): create/update the baseline
node scripts/visual-regression/designers-directory.mjs --update

# Subsequent runs: compare against the committed baseline
node scripts/visual-regression/designers-directory.mjs
```

The script asserts:
- Parent brand cards are ~2× the width of designer cards.
- Parent / designer card heights match within 6px.
- Parent-label captions are visible / hidden per `HIDE_PARENT_LABEL_SLUGS`.
- Pixel diff vs `baselines/designers-directory.png` stays under 2%.

Outputs land in `tests/visual/output/` (current + diff PNGs) — gitignored.
Commit baselines under `tests/visual/baselines/` only.
