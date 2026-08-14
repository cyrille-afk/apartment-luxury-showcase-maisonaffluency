update designer_curator_picks
set variant_image_map = (
  select jsonb_object_agg(replace(replace(k, 'versiona', 'shapea'), 'versionb', 'shapeb'), v)
  from jsonb_each(variant_image_map) as t(k, v)
)
where id = 'b5ca7ae6-fc77-4cde-9137-65bf0e24e9b7' and variant_image_map is not null;