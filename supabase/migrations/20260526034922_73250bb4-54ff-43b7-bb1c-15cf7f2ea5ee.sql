UPDATE public.designers
SET biography = REPLACE(
  biography,
  'https://www.atelierfevrier.com/wp-content/uploads/2025/06/Atelier-feb-24-106-scaled.jpg |  | left',
  'https://www.atelierfevrier.com/wp-content/uploads/2025/06/Atelier-feb-24-106-scaled.jpg'
)
WHERE id = '978acfb6-03a8-4e78-a208-33d33d88dab6';