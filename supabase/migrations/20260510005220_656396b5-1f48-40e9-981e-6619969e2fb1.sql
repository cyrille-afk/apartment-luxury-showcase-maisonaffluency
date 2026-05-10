UPDATE designers
SET biography = REPLACE(
  biography,
  'https://www.youtube.com/watch?v=Fa7f1xHOc-I | Discover the Alpange piano',
  'https://www.youtube.com/watch?v=Fa7f1xHOc-I | Discover the Alpange piano | poster:https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/videos/alpange-cover.jpg'
)
WHERE slug = 'alpange';