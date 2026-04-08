UPDATE public.journal_articles
SET content = replace(
  content,
  $$## Théorème Editions

Théorème — the Paris-based gallery and publisher of limited-edition furniture — brings a curated stand that typically features a rotating cast of designers. Among them: **Emmanuelle Simon** and **Francesco Balzano**, both represented on Maison Affluency. Théorème's model is distinctive: they commission, produce, and sell numbered editions, bridging the gap between gallery and maison d'édition.

See Théorème's designers on Maison Affluency: [Emmanuelle Simon](/designers/emmanuelle-simon-theoreme) · [Francesco Balzano](/designers/francesco-balzano-theoreme)

$$,
  $$## Théorème Editions

Théorème — the Paris-based gallery and publisher of limited-edition furniture — brings a curated stand that typically features a rotating cast of designers. Among them: **Emmanuelle Simon** and **Francesco Balzano**, both represented on Maison Affluency. Théorème's model is distinctive: they commission, produce, and sell numbered editions, bridging the gap between gallery and maison d'édition.

See Théorème's designers on Maison Affluency: [Emmanuelle Simon](/designers/emmanuelle-simon-theoreme) · [Francesco Balzano](/designers/francesco-balzano-theoreme)

## Hom Le Xuan

Hom Le Xuan brings a singular material language to PAD: lacquer not as decoration, but as architecture. Working between contemporary collectible design and the centuries-old traditions of Vietnamese lacquer, his pieces possess an unusual density — surfaces that seem to hold light inside them rather than merely reflect it. At a fair often dominated by bronze, parchment and polished metal, that tactile depth gives his work a distinct presence.

What makes Hom Le Xuan important in the context of PAD is precisely this refusal of easy categorisation. His objects feel at once sculptural and ceremonial, rigorous and sensual. They carry the memory of artisanal process — layering, sanding, polishing, repetition — while arriving as resolutely contemporary works for collectors who understand material sophistication.

For Maison Affluency, his presence strengthens the argument that the next chapter of collectible design will be written not only through form, but through mastery of finish, surface, and cultural technique. In a fair defined by connoisseurship, Hom Le Xuan stands out for exactly that reason.

Explore his work on Maison Affluency: [View designer page](/designers/hom-le-xuan)

$$
),
updated_at = now()
WHERE slug = 'pad-paris-2026-tuileries-design-fair-report'
  AND position('## Hom Le Xuan' in content) = 0;