UPDATE journal_articles 
SET content = REPLACE(
  content, 
  'The Niko sofa — limited and numbered edition — distils Lemaire''s philosophy of radical simplicity.', 
  'The Niko sofa distils Lemaire''s philosophy of radical simplicity into upholstered form.'
)
WHERE slug = 'thierry-lemaire-radical-simplicity'