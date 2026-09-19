insert into public.fabrics (name, supplier, category, image_url, is_active)
select v.name, 'Dagmar', 'Fabric & Leather',
       'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/dagmar/'||v.f||'.jpg', true
from (values ('Medium Army','medium-army'),('Medium Cigare','medium-cigare'),('Medium Mud','medium-mud'),
             ('Bold Army','bold-army'),('Bold Cigare','bold-cigare')) as v(name,f)
where not exists (select 1 from public.fabrics x where x.name = v.name and x.supplier = 'Dagmar');

insert into public.designer_curator_picks
(designer_id, title, slug, subtitle, category, subcategory, description, materials, dimensions, edition, origin,
 lead_time, currency, price_prefix, base_axis_label, top_axis_label, variant_placeholder, wood_label_override,
 allow_com_col, com_meters, is_upholstered, image_url, is_hidden, sort_order)
values
('274a57ec-d50f-471f-b549-754af6e335e8','Samsas Chair','samsas-chair','Carl Malmsten','Seating','Armchairs',
 E'Carl Malmsten drew the Samsas Chair as an exercise in gentle proportion: a compact, buttoned lounge chair whose rounded back gathers the sitter in without ever feeling heavy. Made in Sweden by Dagmar to the original drawings, the frame is hand-upholstered and set on turned solid wood legs.\n\nOffered across a curated range of Pierre Frey, De Le Cuona and Chase Erwin upholsteries, with oiled oak, fumed oak or oiled walnut legs. Customer''s own material is welcome.',
 'Hand-upholstered beech frame with traditional sprung seat, solid oak or American walnut turned legs, hand-finished. Made in Sweden.',
 'W 71 cm (27.9") x H 82 cm (32.3")','Re-edition','Sweden','10–12 weeks','USD','From',
 'Wood Finish','Upholstery','Select Your Fabric Finish','Select Your Wood Finish', true, 2.5, true,
 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/products/dagmar/cirkus-chair-lifestyle.jpg', false, 90),
('274a57ec-d50f-471f-b549-754af6e335e8','Cirkus Chair','cirkus-chair','Carl Malmsten','Seating','Armchairs',
 E'The Cirkus Chair is Carl Malmsten at his most theatrical — flared arms, a high buttoned back and a silhouette that reads as sculpture from every angle. Dagmar produces it in Sweden from the original pattern, each chair hand-upholstered and finished on turned solid wood legs.\n\nSpecify from Pierre Frey mohair and cotton velvets, De Le Cuona linens or Chase Erwin bouclés, over oiled oak, fumed oak or oiled walnut. Customer''s own material is welcome.',
 'Hand-upholstered beech frame, deep buttoned back, solid oak or American walnut turned legs, hand-finished. Made in Sweden.',
 'W 71 cm (27.9") x H 82 cm (32.3")','Re-edition','Sweden','10–12 weeks','USD','From',
 'Wood Finish','Upholstery','Select Your Fabric Finish','Select Your Wood Finish', true, 6.5, true,
 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/products/dagmar/cirkus-chair-lifestyle.jpg', false, 90),
('274a57ec-d50f-471f-b549-754af6e335e8','Samsas Rund Sofa','samsas-rund-sofa','Carl Malmsten','Seating','Sofas',
 E'A three-seat companion to the Samsas Chair, the Samsas Rund Sofa curves in plan so that conversation turns inward. The buttoned back follows the arc of the frame, and the whole piece floats on slender turned legs.\n\nHand-built in Sweden by Dagmar and offered across the full Carl Malmsten upholstery range, with oiled oak, fumed oak or oiled walnut legs.',
 'Curved hand-upholstered beech frame, buttoned back, solid oak or American walnut turned legs, hand-finished. Made in Sweden.',
 'W 200 cm (78.7") x H 89 cm (35")','Re-edition','Sweden','10–12 weeks','USD','From',
 'Wood Finish','Upholstery','Select Your Fabric Finish','Select Your Wood Finish', true, 2.5, true,
 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/products/dagmar/samspel-sofa-lifestyle.jpg', false, 90),
('274a57ec-d50f-471f-b549-754af6e335e8','Samspel Sofa','samspel-sofa','Carl Malmsten','Seating','Sofas',
 E'Samspel — Swedish for interplay — is a two-seat sofa whose scrolled arms and softly waisted back play against one another. Carl Malmsten''s drawing is reproduced faithfully by Dagmar in Sweden, hand-upholstered and set on turned solid wood legs.\n\nAvailable in Skandilock curly sheepskin as well as the Pierre Frey, De Le Cuona and Chase Erwin upholstery range, with oiled oak, fumed oak or oiled walnut legs.',
 'Hand-upholstered beech frame with scrolled arms, solid oak or American walnut turned legs, hand-finished. Made in Sweden.',
 'W 151 cm (59.4") x H 83 cm (32.6")','Re-edition','Sweden','10–12 weeks','USD','From',
 'Wood Finish','Upholstery','Select Your Fabric Finish','Select Your Wood Finish', true, 5.1, true,
 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/products/dagmar/samspel-sofa-lifestyle.jpg', false, 90);

with tiers(slug, top, usd, ord) as (values
 ('samsas-chair','Bold PIERRE FREY',6662,1),('samsas-chair','Attenborough DE LE CUONA',5812,2),
 ('samsas-chair','Embrace CHASE ERWIN',5245,3),('samsas-chair','Medium PIERRE FREY',5245,4),
 ('samsas-chair','Basile PIERRE FREY',5032,5),('samsas-chair','Arsene PIERRE FREY',5032,6),
 ('samsas-chair','Opera PIERRE FREY',4890,7),('samsas-chair','COM',4607,8),
 ('cirkus-chair','Bold PIERRE FREY',7442,1),('cirkus-chair','Attenborough DE LE CUONA',6733,2),
 ('cirkus-chair','Embrace CHASE ERWIN',6095,3),('cirkus-chair','Medium PIERRE FREY',6095,4),
 ('cirkus-chair','Basile PIERRE FREY',5954,5),('cirkus-chair','Arsene PIERRE FREY',5954,6),
 ('cirkus-chair','Opera PIERRE FREY',5741,7),('cirkus-chair','COM',5387,8),
 ('samsas-rund-sofa','Bold PIERRE FREY',14104,1),('samsas-rund-sofa','Attenborough DE LE CUONA',12120,2),
 ('samsas-rund-sofa','Embrace CHASE ERWIN',10348,3),('samsas-rund-sofa','Medium PIERRE FREY',10348,4),
 ('samsas-rund-sofa','Basile PIERRE FREY',10206,5),('samsas-rund-sofa','Arsene PIERRE FREY',10206,6),
 ('samsas-rund-sofa','Opera PIERRE FREY',9497,7),('samsas-rund-sofa','COM',8363,8),
 ('samspel-sofa','Sheepskin SKANDILOCK',10631,1),('samspel-sofa','Bold PIERRE FREY',12403,2),
 ('samspel-sofa','Attenborough DE LE CUONA',10844,3),('samspel-sofa','Embrace CHASE ERWIN',9639,4),
 ('samspel-sofa','Medium PIERRE FREY',9639,5),('samspel-sofa','Basile PIERRE FREY',9143,6),
 ('samspel-sofa','Arsene PIERRE FREY',9143,7),('samspel-sofa','Opera PIERRE FREY',8718,8),
 ('samspel-sofa','COM',7796,9)
), feet(slug, upcharge) as (values
 ('samsas-chair',354),('cirkus-chair',354),('samsas-rund-sofa',425),('samspel-sofa',354)
), woods(base, wo, extra) as (values ('Fumed Oak',1,0),('Oiled Oak',2,0),('Oiled Walnut',3,1)
), matrix as (
  select t.slug,
         jsonb_build_object('base', w.base, 'top', t.top,
           'price_cents', (t.usd + w.extra * f.upcharge) * 100) as v,
         (t.usd + w.extra * f.upcharge) * 100 as cents,
         t.ord, w.wo
  from tiers t join feet f on f.slug = t.slug cross join woods w
), agg as (
  select slug, jsonb_agg(v order by ord, wo) as variants, min(cents) as min_cents
  from matrix group by slug
)
update public.designer_curator_picks p
set size_variants = a.variants, trade_price_cents = a.min_cents
from agg a
where p.slug = a.slug and p.designer_id = '274a57ec-d50f-471f-b549-754af6e335e8';

with fabmap(fname, tier, ord) as (values
 ('Sheepskin 09 Moonlight','Sheepskin SKANDILOCK',1),('Sheepskin 07 Sahara','Sheepskin SKANDILOCK',2),
 ('Sheepskin 18 Maple','Sheepskin SKANDILOCK',3),('Sheepskin 02 Off-white','Sheepskin SKANDILOCK',4),
 ('Bold Army','Bold PIERRE FREY',5),('Bold Cigare','Bold PIERRE FREY',6),
 ('Attenborough Polar','Attenborough DE LE CUONA',7),('Attenborough Hyena','Attenborough DE LE CUONA',8),
 ('Attenborough Swamp','Attenborough DE LE CUONA',9),
 ('Embrace Barr','Embrace CHASE ERWIN',10),('Embrace Cotton White','Embrace CHASE ERWIN',11),
 ('Embrace Stone','Embrace CHASE ERWIN',12),
 ('Medium Army','Medium PIERRE FREY',13),('Medium Cigare','Medium PIERRE FREY',14),('Medium Mud','Medium PIERRE FREY',15),
 ('Basile Crème','Basile PIERRE FREY',16),('Basile Naturel','Basile PIERRE FREY',17),
 ('Arsene Coquillage','Arsene PIERRE FREY',18),('Arsene Quinoa','Arsene PIERRE FREY',19),
 ('Arsene Plume','Arsene PIERRE FREY',20),('Arsene Cachou','Arsene PIERRE FREY',21),
 ('Opera Beige','Opera PIERRE FREY',22),('Opera Camel','Opera PIERRE FREY',23),
 ('Opera Cuivre','Opera PIERRE FREY',24),('Opera Olive','Opera PIERRE FREY',25)
), woodmap(fname, ord) as (values ('Oiled Oak',26),('Fumed Oak',27),('Oiled Walnut',28)
), picks as (
  select id, slug, size_variants from public.designer_curator_picks
  where designer_id = '274a57ec-d50f-471f-b549-754af6e335e8'
    and slug in ('samsas-chair','cirkus-chair','samsas-rund-sofa','samspel-sofa')
), newrows as (
  select p.id as pick_id, f.id as fabric_id, m.ord, m.tier
  from picks p
  join fabmap m on exists (
    select 1 from jsonb_array_elements(p.size_variants) e where e->>'top' = m.tier
  )
  join public.fabrics f on f.name = m.fname and f.supplier = 'Dagmar'
  union all
  select p.id, f.id, w.ord, null
  from picks p cross join woodmap w
  join public.fabrics f on f.name = w.fname and f.supplier = 'Dagmar'
)
insert into public.product_fabrics (pick_id, fabric_id, sort_order, price_tier_label)
select pick_id, fabric_id, ord, tier from newrows;