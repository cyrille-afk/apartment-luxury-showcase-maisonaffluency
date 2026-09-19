UPDATE designers SET biography = replace(
  biography,
  'De Fil en Déco interview, 2024',
  E'De Fil en D\u00e9co interview, 2024\n(\u2018All our rugs seem alive and animated through a play of texture and movement. The inspiration may be the same, but the expression is always different.\u2019)'
) WHERE slug='atelier-fevrier';