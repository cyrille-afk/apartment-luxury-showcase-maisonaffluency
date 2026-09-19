UPDATE designer_curator_picks SET sort_order = CASE title
  WHEN 'Casque' THEN 0
  WHEN 'Dais' THEN 1
  WHEN 'Moiré Table Lamp' THEN 2
  WHEN 'Koi Carps' THEN 3
  WHEN 'Corteza Console Table' THEN 4
  WHEN 'Ondas Sconce' THEN 5
  WHEN 'Reef Vessels' THEN 6
  WHEN 'Arbor Desk' THEN 7
  WHEN 'Plume Table Lamp' THEN 8
  WHEN 'Barbican Cabinet' THEN 9
  WHEN 'Otto Table Lamp' THEN 10
  WHEN 'Hammered Bowls' THEN 11
  WHEN 'Ondas Bench' THEN 12
  WHEN 'Galea Lantern' THEN 13
END
WHERE designer_id = 'de46d314-2935-4aca-9a82-b014971614c8';