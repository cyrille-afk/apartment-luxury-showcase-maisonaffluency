UPDATE public.designer_curator_picks
SET gallery_images = ARRAY[
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1776307150/Screen_Shot_2026-04-16_at_10.22.46_AM_bep333.png',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1776307150/Screen_Shot_2026-04-16_at_10.23.10_AM_lgrsqr.png',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1776387468/Screen_Shot_2026-04-17_at_8.57.24_AM_vejuth.png',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1776307150/Screen_Shot_2026-04-16_at_10.23.18_AM_g8vsyc.png'
]
WHERE lower(title) LIKE 'rua leblon%'
  AND (gallery_images IS NULL OR array_length(gallery_images, 1) IS NULL);