UPDATE designers SET biography = replace(
  biography,
  E'interview, 2024\n(\u2018All our rugs',
  E'interview, 2024 <em>\u2018All our rugs'
) WHERE slug='atelier-fevrier';