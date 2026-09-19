update public.designer_curator_picks set dimensions = case slug
  when 'samsas-chair' then 'W 71 x H 82 cm'
  when 'cirkus-chair' then 'W 71 x H 82 cm'
  when 'samsas-rund-sofa' then 'W 200 x H 89 cm'
  when 'samspel-sofa' then 'W 151 x H 83 cm' end
where designer_id = '274a57ec-d50f-471f-b549-754af6e335e8'
  and slug in ('samsas-chair','cirkus-chair','samsas-rund-sofa','samspel-sofa');