-- Audit cleanup: Adrien Messié tearsheet duplicates (autosave-per-keystroke artefacts from 2026-05-18)
-- Keep only canonical:
--   trade_products: 280ed5d6 "Fibonacci Side Table for Theorme"
--   designer_curator_picks: 32c551dd "Fibonacci Side Table for Theorme"

DELETE FROM trade_products WHERE brand_name = 'Adrien Messié' AND id <> '280ed5d6-a8b2-49b7-8e1e-be3ec06e1657';

DELETE FROM designer_curator_picks WHERE id = '3263bb12-4cf7-4c72-908d-0892efef09ac';