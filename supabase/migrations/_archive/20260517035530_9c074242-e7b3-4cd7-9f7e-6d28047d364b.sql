UPDATE journal_articles
SET content = content || E'\n\n---\n\n**Related reading:** explore our [designers directory](https://www.maisonaffluency.com/designers), browse the [collectibles selection](https://www.maisonaffluency.com/collectibles), discover the [trade program](https://www.maisonaffluency.com/trade-program), or return to the [Journal](https://www.maisonaffluency.com/journal) for more editorials.'
WHERE slug = 'matter-shape-paris-march-6-9-2026'
  AND content NOT LIKE '%Related reading:%';