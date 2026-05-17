UPDATE journal_articles
SET content = content || E'\n\n---\n\n**Related reading:** browse the [Thierry Lemaire designer profile](https://www.maisonaffluency.com/designers/thierry-lemaire), explore our full [designers directory](https://www.maisonaffluency.com/designers), discover our [collectibles selection](https://www.maisonaffluency.com/collectibles), or return to the [Journal](https://www.maisonaffluency.com/journal) for more editorials.'
WHERE slug = 'thierry-lemaire-radical-simplicity'
  AND content NOT LIKE '%Related reading:%';