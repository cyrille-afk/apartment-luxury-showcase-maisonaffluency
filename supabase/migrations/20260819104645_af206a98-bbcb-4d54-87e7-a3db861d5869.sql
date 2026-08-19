update public.designers
set biography_images = array_prepend('https://cdn.shopify.com/videos/c/o/v/e58fc53189ae4cb5a8bc5f5556ce77b8.mp4 | Our Process', biography_images)
where slug = 'dagmar-london'
  and not exists (
    select 1 from unnest(biography_images) x where x like '%e58fc53189ae4cb5a8bc5f5556ce77b8%'
  );