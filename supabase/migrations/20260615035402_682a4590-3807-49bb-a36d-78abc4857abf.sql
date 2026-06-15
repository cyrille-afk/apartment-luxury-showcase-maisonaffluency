
-- Seed Ecart upholstery + wood finishes for Upholstered Back Sofa c. 1930
WITH pick AS (
  SELECT 'a21f9847-b71e-4f4f-abcc-856c0313b584'::uuid AS id
),
inserted AS (
  INSERT INTO public.fabrics (name, category, supplier, sort_order, is_active)
  VALUES
    ('Cole Cinnamon',                       'Upholstery', 'Ecart', 10, true),
    ('Elsa Pink',                           'Upholstery', 'Ecart', 20, true),
    ('Elsa Greige',                         'Upholstery', 'Ecart', 30, true),
    ('Eyre Beige',                          'Upholstery', 'Ecart', 40, true),
    ('Nancy Beige',                         'Upholstery', 'Ecart', 50, true),
    ('Oatmeal Shearling',                   'Upholstery', 'Ecart', 60, true),
    ('White Shearling',                     'Upholstery', 'Ecart', 70, true),
    ('Smooth natural oak with matte varnish','Wood',       'Ecart', 100, true),
    ('Smooth brown oak with matte varnish',  'Wood',       'Ecart', 110, true),
    ('Smooth black oak with matte varnish',  'Wood',       'Ecart', 120, true)
  RETURNING id, sort_order
)
INSERT INTO public.product_fabrics (pick_id, fabric_id, sort_order)
SELECT (SELECT id FROM pick), i.id, i.sort_order
FROM inserted i;
