UPDATE public.designers
SET biography = biography || E'\n\nhttps://www.youtube.com/watch?v=aXUsRNl_FqI | Valéria Nascimento — Studio Visit'
WHERE id = '4d069840-f40a-4d20-8075-e052dbdeaba1'
  AND biography NOT LIKE '%aXUsRNl_FqI%';