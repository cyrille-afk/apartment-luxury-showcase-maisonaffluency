UPDATE designers SET biography = replace(
  biography,
  E'diff\u00e9rente.\u2019</strong> \u2014 Lisa Mukhia Pretet, De Fil en D\u00e9co interview, 2024 <em>\u2018All our rugs seem alive and animated through a play of texture and movement. The inspiration may be the same, but the expression is always different.\u2019</em>',
  E'diff\u00e9rente.\u2019</strong> <em>\u2018All our rugs seem alive and animated through a play of texture and movement. The inspiration may be the same, but the expression is always different.\u2019</em> \u2014 Lisa Mukhia Pretet, De Fil en D\u00e9co interview, 2024'
) WHERE slug='atelier-fevrier';