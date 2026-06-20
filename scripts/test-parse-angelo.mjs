import { parseSingleAxisLabel, computeVariantAxes } from '../src/lib/parseSizeVariants.ts';
const sv = [
  {label:"Angelo M/R 130: Ø 130 × H 75 cm Kynos", price_cents:1211600},
  {label:"Angelo M/R 130: Ø 130 × H 75 cm Grafite", price_cents:1301000},
  {label:"Angelo M/R 130: Ø 130 × H 75 cm Travertino Rosso / Grey Saint Laurent / Picasso Green", price_cents:1426300},
  {label:"Angelo M/R 130: Ø 130 × H 75 cm Port Saint Laurent / Travertino Silver / Rosso Lepanto", price_cents:1682900},
  {label:"Angelo M/R 130: Ø 130 × H 75 cm Bianco Statuarietto", price_cents:2099800},
  {label:"Angelo M/R 160: Ø 160 × H 75 cm Kynos", price_cents:1325100},
];
console.log("PARSED LABELS:");
for (const v of sv) console.log("  ->", parseSingleAxisLabel(v.label));
const axes = computeVariantAxes(sv);
console.log("\nsingleSizeOptions:", axes.singleSizeOptions);
console.log("singleMaterialOptions:", axes.singleMaterialOptions);
console.log("hasSingleAxisSplit:", axes.hasSingleAxisSplit);
