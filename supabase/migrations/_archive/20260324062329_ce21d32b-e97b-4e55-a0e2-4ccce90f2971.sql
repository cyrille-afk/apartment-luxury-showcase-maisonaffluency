
UPDATE public.designers
SET hero_image_url = 'https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,h_900,c_fill,g_north,y_80,q_auto,f_auto/gabriel-hendifar-apparatus-studio',
    updated_at = now()
WHERE slug = 'apparatus-studio';
