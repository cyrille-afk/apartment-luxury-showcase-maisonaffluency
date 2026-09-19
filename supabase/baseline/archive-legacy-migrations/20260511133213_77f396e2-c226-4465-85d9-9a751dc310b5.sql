UPDATE public.designers
SET image_url = '',
    updated_at = now()
WHERE slug = 'victoria-wilmotte-theoreme'
  AND image_url = 'https://blogs-images.forbes.com/ceciliapelloux/files/2019/02/2017-03-22_Station-F%C2%A9Luc-Castel-e1549391914140-1200x932.jpg';