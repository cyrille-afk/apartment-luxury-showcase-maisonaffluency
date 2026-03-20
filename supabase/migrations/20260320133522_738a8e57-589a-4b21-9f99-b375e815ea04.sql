UPDATE journal_articles 
SET content = REPLACE(
  content, 
  'Portions are adapted from published profiles in Elle Decor, The Future Perfect, and Brabbu Design Forces.', 
  'Portions are adapted from published profiles in Elle Decor and The Future Perfect.'
)
WHERE slug = 'thierry-lemaire-radical-simplicity'