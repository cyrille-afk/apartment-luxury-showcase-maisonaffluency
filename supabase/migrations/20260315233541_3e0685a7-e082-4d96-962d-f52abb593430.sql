-- Fix misspelled designer name "Alexandre Lamont" → "Alexander Lamont"
UPDATE gallery_hotspots SET designer_name = 'Alexander Lamont' WHERE designer_name = 'Alexandre Lamont';

-- Fix product name "Corteza Console" → "Corteza Console Table"
UPDATE gallery_hotspots SET product_name = 'Corteza Console Table' WHERE product_name = 'Corteza Console';

-- Fix "Corteza Console (shagreen leather, curved bullnose edge)" → "Corteza Console Table"
UPDATE gallery_hotspots SET product_name = 'Corteza Console Table', designer_name = 'Alexander Lamont' WHERE product_name LIKE 'Corteza Console%' AND designer_name ILIKE '%lamont%';

-- Fix "Straw Marquetry Mantle Box" → "Mantle Boxes"
UPDATE gallery_hotspots SET product_name = 'Mantle Boxes', materials = 'Burnished Woven Straw, Silvered Brass Feet, Walnut', dimensions = 'Small W 12 × H 12.5 cm
Medium W 15 × H 16 cm
W 18 × H 17.5 cm' WHERE product_name = 'Straw Marquetry Mantle Box';