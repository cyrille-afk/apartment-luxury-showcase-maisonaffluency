# AR export validation

Production builds run `verify-ar-exports.mjs --warn-only` before bundling. Findings are explicitly printed; they do not silently disable AR or rewrite catalogue models. `bun run check:ar` is the strict review command: any flagged **or unconfirmed** export exits nonzero. The existing best-effort prebuild wrapper is deliberately not used.

The check downloads each source GLB, decodes compressed geometry, follows node transforms, and applies the **same revision-specific scale and orientation helper as Product3DViewer**. It never normalizes bounds to one metre, which would hide unit errors.

- Invalid/empty geometry and exports smaller than 5cm or larger than 10m are flagged.
- Recorded-size disagreements exceeding 20% or 5cm are flagged; a matching axis permutation flags a likely orientation mismatch.
- An audited source-up vector must end within approximately 11° of positive Y. Sideways/inverted exports are flagged.
- Missing measurements or an unaudited up direction remain **unconfirmed**, not verified. Bounds alone cannot prove a piece stands on its legs.

`scripts/data/ar-model-inventory.json` is a dated, price-free snapshot of 35 active, visible catalogue GLB variants. Refresh it whenever catalogue files are added/replaced; this does **not** query the private database during publishing or imply live inventory coverage. Reference measurements belong to the exact size variant; IBO's audited source dimensions are deliberately separate from its mixed-shape catalogue defaults. Never invent a source-up vector to clear a warning.

The normal report is generated under `node_modules/.cache/ar-export-validation.json`. To retain an audit, pass `--report audits/ar-export-validation.json`. Native Quick Look device placement still needs a physical iPhone check; this is geometry validation, not a claim that every device can open AR.