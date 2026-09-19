
-- 1) Link missing fabric/leather rows to X Stool (Round) c.1934 pick
INSERT INTO public.product_fabrics (pick_id, fabric_id, sort_order)
VALUES
  ('e5f9dfaa-20d3-4a64-a3ff-e6c2edd40f45', 'eff4e82e-fbdd-43f0-a330-6f7408377b88', 5),  -- Oatmeal Shearling
  ('e5f9dfaa-20d3-4a64-a3ff-e6c2edd40f45', '5854973f-5476-453f-aa33-ab0d72622e44', 6),  -- White Shearling (= Oatmeal White)
  ('e5f9dfaa-20d3-4a64-a3ff-e6c2edd40f45', '25f82b61-b0d7-444a-b859-f8e91b0ae9a8', 7),  -- Cognac leather
  ('e5f9dfaa-20d3-4a64-a3ff-e6c2edd40f45', '0c3973f7-f587-4b0d-a063-74bf22e15b78', 8),  -- Dark chocolate leather
  ('e5f9dfaa-20d3-4a64-a3ff-e6c2edd40f45', 'f87cd7a6-0cac-4268-b634-d911191c11fd', 9),  -- Black leather
  ('e5f9dfaa-20d3-4a64-a3ff-e6c2edd40f45', 'dac1ac42-9a56-4264-b4be-391f41fbc4db', 10)  -- Hide
ON CONFLICT (pick_id, fabric_id) DO NOTHING;

-- 2) Rename ECRT-CH wood codes to descriptive oak finish names (where finish is known)
UPDATE public.fabrics SET name = 'Smooth black oak with matte varnish'        WHERE id = '7f7f0a4c-08a1-49eb-8ef9-0f3ab4f94093'; -- ECRT-CH-8
UPDATE public.fabrics SET name = 'Sandblasted natural oak with matte varnish' WHERE id = '4e3416e5-b44c-42c7-b887-6d02179f9267'; -- ECRT-CH-12
UPDATE public.fabrics SET name = 'Sandblasted brown oak with matte varnish'   WHERE id = '99c3fe43-4761-4f32-831d-c12b73a9ba86'; -- ECRT-CH-14
UPDATE public.fabrics SET name = 'Sandblasted black oak with matte varnish'   WHERE id = '97ce4cde-c0b4-4541-a108-6d61628780e6'; -- ECRT-CH-13
