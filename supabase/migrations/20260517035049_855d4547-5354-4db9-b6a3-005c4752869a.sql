UPDATE journal_articles
SET content = replace(
  replace(
    replace(
      replace(
        content,
        '## Andrée Putman Studio',
        '## [Andrée Putman Studio](https://www.maisonaffluency.com/designers/andree-putman)'
      ),
      '## Hom Le Xuan',
      '## [Hom Le Xuan](https://www.maisonaffluency.com/designers/hom-le-xuan)'
    ),
    '## Reda Amalou Design',
    '## [Reda Amalou Design](https://www.maisonaffluency.com/designers/reda-amalou)'
  ),
  'For enquiries about any of the designers or pieces mentioned, please contact [concierge@myaffluency.com](mailto:concierge@myaffluency.com).',
  E'For enquiries about any of the designers or pieces mentioned, please contact [concierge@myaffluency.com](mailto:concierge@myaffluency.com).\n\n---\n\n**Related reading:** explore the full [Maison Affluency designers directory](https://www.maisonaffluency.com/designers), browse our [collectibles selection](https://www.maisonaffluency.com/collectibles), or return to the [Journal](https://www.maisonaffluency.com/journal) for more editorials.'
)
WHERE slug = 'art-paris-2026-maison-affluency-designers-grand-palais';