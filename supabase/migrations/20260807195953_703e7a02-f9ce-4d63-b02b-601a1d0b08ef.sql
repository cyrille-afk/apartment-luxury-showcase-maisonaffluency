-- Link Clam Stool photos to wood + sheepskin finishes, mirroring the Clam Chair.
with sets(fname, idx) as (
  values
    ('Oiled Walnut', array[1,2,3,4,5,6,7,8,17]),
    ('Oiled Oak', array[9,10,11,17]),
    ('Fumed Oak', array[12,13,14,15,16,17]),
    ('Sheepskin 09 Moonlight', array[1,2,3,4,5,6,7,8,17]),
    ('Sheepskin 07 Sahara', array[12,13,14,15,16,17])
)
update public.product_fabrics pf
set image_indices = s.idx
from public.fabrics f, sets s
where pf.fabric_id = f.id
  and f.name = s.fname
  and pf.pick_id in ('19bbbc66-6dde-4fd3-ad31-1ba62b0d9eef','a1000000-0000-4000-8000-000000000004');