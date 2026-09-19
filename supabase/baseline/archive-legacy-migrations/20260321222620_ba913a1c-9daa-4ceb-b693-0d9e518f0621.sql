
INSERT INTO public.designers (name, founder, slug, source, specialty, biography, notable_works, philosophy, image_url, is_published, sort_order)
VALUES
  ('Collection Particulière', 'Collection Particulière', 'collection-particuliere', 'atelier', 'Contemporary furniture, lighting, and sculptural objects', '', '', '', '', false, 0),
  ('Delcourt Collection', 'Delcourt Collection', 'delcourt-collection', 'atelier', 'Contemporary furniture and objects by Christophe Delcourt', '', '', '', '', false, 0),
  ('Galerie MCDE', 'Galerie MCDE', 'galerie-mcde', 'atelier', 'Contemporary design gallery', '', '', '', '', false, 0),
  ('Haymann Editions', 'Haymann Editions', 'haymann-editions', 'atelier', 'Lighting and furniture editions', '', '', '', '', false, 0),
  ('MMairo', 'MMairo', 'mmairo', 'atelier', 'Murano glass lighting and objects', '', '', '', '', false, 0),
  ('Ozone', 'Ozone', 'ozone', 'atelier', 'Bronze furniture and lighting editions', '', '', '', '', false, 0),
  ('Pouenat', 'Pouenat', 'pouenat', 'atelier', 'Bronze and iron furniture, lighting, and architectural metalwork', '', '', '', '', false, 0),
  ('Sé Collections', 'Sé Collections', 'se-collections', 'atelier', 'Luxury furniture and sculptural design', '', '', '', '', false, 0),
  ('Théorème Editions', 'Théorème Editions', 'theoreme-editions', 'atelier', 'Contemporary furniture and object editions', '', '', '', '', false, 0)
ON CONFLICT DO NOTHING;
