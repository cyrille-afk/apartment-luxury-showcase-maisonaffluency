
-- Add atelier brands (founder = name)
INSERT INTO designers (name, slug, founder, is_published, specialty, source) VALUES
  ('Alexander Lamont', 'alexander-lamont', 'Alexander Lamont', true, 'Luxury furniture, lacquer, shagreen, straw marquetry', 'partner'),
  ('Alinea', 'alinea', 'Alinea', true, 'Contemporary furniture and lighting', 'partner'),
  ('Apparatus Studio', 'apparatus-studio', 'Apparatus Studio', true, 'Sculptural lighting and furniture', 'partner'),
  ('Collection Particulière', 'collection-particuliere', 'Collection Particulière', true, 'Noble furniture, sculptural objects, collectible design', 'partner'),
  ('De La Espada', 'de-la-espada', 'De La Espada', true, 'Contemporary solid wood furniture', 'partner'),
  ('Delcourt Collection', 'delcourt-collection', 'Delcourt Collection', true, 'Furniture, lighting, sculptural design', 'partner'),
  ('Entrelacs', 'entrelacs', 'Entrelacs', true, 'Leather furniture, luxury upholstery', 'partner'),
  ('Haymann Editions', 'haymann-editions', 'Haymann Editions', true, 'Collectible lighting, furniture, glass', 'partner'),
  ('La Chance', 'la-chance', 'La Chance', true, 'Contemporary furniture and objects', 'partner'),
  ('Man of Parts', 'man-of-parts', 'Man of Parts', true, 'Contemporary modular furniture', 'partner'),
  ('OKHA', 'okha', 'OKHA', true, 'South African luxury furniture and lighting', 'partner')
ON CONFLICT (slug) DO UPDATE SET founder = EXCLUDED.founder, is_published = true;

-- Add individual designers (no founder)
INSERT INTO designers (name, slug, is_published, specialty, source) VALUES
  ('Andrée Putman', 'andree-putman', true, 'Interior design, furniture, lighting', 'partner'),
  ('Bieke Casteleyn', 'bieke-casteleyn', true, 'Ceramic art, sculptural objects', 'partner'),
  ('Bina Baitel', 'bina-baitel', true, 'Furniture, lighting, product design', 'partner'),
  ('Emmanuel Babled', 'emmanuel-babled', true, 'Glass, marble, sculptural furniture', 'partner'),
  ('Jan Kath', 'jan-kath', true, 'Contemporary rugs and textiles', 'partner'),
  ('Jeremy Maxwell Wintrebert', 'jeremy-maxwell-wintrebert', true, 'Glass sculpture, blown glass, lighting', 'partner'),
  ('Kerstens', 'kerstens', true, 'Furniture, bespoke design', 'partner'),
  ('Victoria Magniant', 'victoria-magniant', true, 'Straw marquetry, furniture, decorative arts', 'partner')
ON CONFLICT (slug) DO UPDATE SET is_published = true;
