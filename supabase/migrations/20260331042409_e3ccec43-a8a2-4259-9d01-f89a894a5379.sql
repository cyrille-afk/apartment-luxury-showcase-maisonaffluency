
-- Publish Stéphane CG and Valérie Rostaing
UPDATE designers SET is_published = true, updated_at = now() WHERE name IN ('Stéphane CG', 'Valérie Rostaing');

-- Create the remaining missing designers
INSERT INTO designers (name, slug, specialty, biography, notable_works, philosophy, image_url, source, is_published) VALUES
  ('Martin Masse', 'martin-masse', 'Furniture & Lighting', '', '', '', '', 'collectible', true),
  ('Mernoe', 'mernoe', 'Furniture Design', '', '', '', '', 'collectible', true),
  ('Se Collections', 'se-collections', 'Furniture & Objects', '', '', '', '', 'collectible', true),
  ('Toulemonde Bochart', 'toulemonde-bochart', 'Rugs & Textiles', '', '', '', '', 'collectible', true)
ON CONFLICT (slug) DO UPDATE SET is_published = true, updated_at = now();
