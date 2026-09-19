UPDATE designers SET biography = replace(
  biography,
  E'always different.\u2019)',
  E'always different.\u2019</em>'
) WHERE slug='atelier-fevrier';