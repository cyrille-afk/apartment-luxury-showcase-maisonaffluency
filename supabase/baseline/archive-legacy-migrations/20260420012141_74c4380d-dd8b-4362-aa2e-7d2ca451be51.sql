UPDATE public.designers
SET biography = replace(
  replace(
    replace(biography, '<strong>', '**'),
    '</strong>', '**'
  ),
  'Alinéa',
  'Alinea'
)
WHERE slug = 'leo-aerts-alinea';