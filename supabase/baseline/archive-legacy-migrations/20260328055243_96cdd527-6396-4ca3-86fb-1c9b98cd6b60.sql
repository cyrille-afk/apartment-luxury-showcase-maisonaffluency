-- Insert new standalone pick for brown oak finish
INSERT INTO designer_curator_picks (designer_id, title, subtitle, category, subcategory, tags, materials, dimensions, image_url, pdf_url, sort_order, currency)
VALUES (
  'd27b1739-39f7-4713-8e92-eaecbe60f853',
  'Akar Dining Chair',
  'Brown Oak Finish',
  'Seating',
  'Chairs',
  ARRAY['Seating', 'Chair'],
  'Brown oak • Alpilles Camargue Trente by Elitis upholstery',
  'L49 × W52 × H85 cm',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1774674278/Screen_Shot_2026-03-28_at_1.03.15_PM_z1uueq.png',
  'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/spec-sheets/Atelier_Pendhapa-Akar_Dining_Chair.pdf',
  2,
  'EUR'
);

-- Clear hover_image_url from the original pick
UPDATE designer_curator_picks SET hover_image_url = NULL WHERE id = '91a8d6eb-497e-465c-b513-20b9ec2106f3';

-- Bump sort_order for items that were at 2+ to make room
UPDATE designer_curator_picks
SET sort_order = sort_order + 1
WHERE designer_id = 'd27b1739-39f7-4713-8e92-eaecbe60f853'
  AND id != '91a8d6eb-497e-465c-b513-20b9ec2106f3'
  AND sort_order >= 2
  AND title != 'Akar Dining Chair';