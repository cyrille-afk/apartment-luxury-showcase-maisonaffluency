UPDATE designers SET biography = regexp_replace(
  biography,
  'https://youtu\.be/xyH_G8ZO4h4\?si=lO_Pf8XhQ6FhMLY9 \| Spaceless presents Pierre Bonnefille',
  'https://youtu.be/xyH_G8ZO4h4?si=lO_Pf8XhQ6FhMLY9 | Spaceless presents Pierre Bonnefille | poster:https://res.cloudinary.com/dif1oamtj/image/upload/w_1280,q_auto,f_auto/Screen_Shot_2026-03-30_at_5.58.39_PM_hfqgkl.png'
) WHERE slug = 'pierre-bonnefille';