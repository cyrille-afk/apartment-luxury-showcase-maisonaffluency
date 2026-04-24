# Maison Affluency — Studio Guide PDF builder

Reusable brand template for Trade Portal Studio Guides. Any new guide
inherits the jade cover, gold wordmark, headers/footers, palette and
section styles automatically.

## Files

- **`brand_template.py`** — the design system (palette, fonts, cover,
  content page, blocks, document template). Do not duplicate this code
  in new guides.
- **`build_guides.py`** — content for the three published guides
  (Shared Filters, FF&E Schedule, Tearsheets) plus the CLI entry point.

## Adding a new guide

1. Open `build_guides.py`.
2. Append a new dict (`MY_GUIDE = {...}`) following the existing shape:
   `filename`, `title`, `subtitle`, `running`, `sections`.
3. Add it to the tuple in `__main__`.
4. Run:

   ```bash
   python scripts/guides/build_guides.py
   ```

   The PDF is written to `public/guides/<slug>.pdf` and ready to be
   wired into `src/pages/guides/registry.ts`.

## Block kinds

```python
("p", "Paragraph copy with <b>inline</b> markup.")
("h", "Sub-heading")
("table", [("Label", "Value"), ("Label", "Value")])
("callout", "Callout title", "Callout body.")
("spacer", 12)
("pagebreak",)
```

## Fonts

Embedded Noto Serif/Sans TTFs are expected in `/tmp/fonts/` (override
with the `MA_FONT_DIR` env var). They are bundled in the PDF so output
is consistent in every viewer.

## Design tokens

Exposed by `brand_template` for future extensions:

| Token       | Hex       | Usage                          |
| ----------- | --------- | ------------------------------ |
| `JADE`      | `#1F3A35` | Cover background, headings     |
| `JADE_DARK` | `#16302B` | Code text                      |
| `GOLD`      | `#B5945A` | Wordmark accent, callout rule  |
| `CREAM`     | `#F4EFE3` | Cover text, callout background |
| `INK`       | `#1A1A1A` | Body text                      |
| `MUTE`      | `#6B6B6B` | Header/footer meta             |
| `RULE`      | `#D9D2C2` | Hairlines, table dividers      |
