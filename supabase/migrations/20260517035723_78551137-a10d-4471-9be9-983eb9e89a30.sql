UPDATE journal_articles
SET content = content || E'\n\n---\n\n**Related reading:** discover the [Pouénat designer profile](https://www.maisonaffluency.com/designers/pouenat), explore our full [designers directory](https://www.maisonaffluency.com/designers), browse the [collectibles selection](https://www.maisonaffluency.com/collectibles), or return to the [Journal](https://www.maisonaffluency.com/journal) for more editorials.'
WHERE slug = 'pouenat-ad-collector-ad100-design-2025'
  AND content NOT LIKE '%Related reading:%';