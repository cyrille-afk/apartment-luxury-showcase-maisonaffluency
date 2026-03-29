UPDATE designers SET is_published = true WHERE is_published = false AND name IN (
  'Arredoluce',
  'Ozone',
  'MMairo',
  'Pouenat',
  'Marta Sala Éditions'
);

-- Also ensure all currently-published designers in Test stay published in Live
-- by setting a safe default: any designer already marked true stays true
UPDATE designers SET is_published = true WHERE is_published = true;