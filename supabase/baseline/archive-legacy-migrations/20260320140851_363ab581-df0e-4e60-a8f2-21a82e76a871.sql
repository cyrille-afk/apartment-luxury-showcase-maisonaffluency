UPDATE journal_articles 
SET content = REPLACE(
  content,
  '<figcaption>Lemaire''s solo exhibition at The Goldwyn House, The Future Perfect, Los Angeles. Photography by Ethan Jones.</figcaption>',
  '<figcaption>Thierry Lemaire''s sculptural furniture highlighted at Galerie Xavier Eeckhout during Paris Design Week.</figcaption>'
)
WHERE slug = 'thierry-lemaire-radical-simplicity'