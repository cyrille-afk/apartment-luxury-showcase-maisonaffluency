UPDATE public.designers
SET founder = 'Adam Courts',
    biography = CASE WHEN COALESCE(NULLIF(biography, ''), '') = '' THEN
      'Adam Courts is the founder and creative director of OKHA, a Cape Town-based design studio at the vanguard of contemporary collectible furniture. Drawing on the rich material culture and craft traditions of southern Africa, Courts creates pieces of sculptural authority and refined restraint. His work — spanning seating, cabinetry, tables and lighting — is distinguished by its precision joinery, architect''s rigour and a deep sensitivity to texture and form. OKHA is represented in landmark private collections and leading design galleries internationally.'
      ELSE biography END,
    philosophy = CASE WHEN COALESCE(NULLIF(philosophy, ''), '') = '' THEN
      'Good design is fearless. It should command a room without shouting — and reward the hand that touches it.'
      ELSE philosophy END,
    notable_works = CASE WHEN COALESCE(NULLIF(notable_works, ''), '') = '' THEN
      'Tectra Coffee Table, Void Dining Chair, Geometer Chair, BNVO Dining Chair, Repose Sofa, OVD Server'
      ELSE notable_works END,
    specialty = CASE WHEN COALESCE(NULLIF(specialty, ''), '') ILIKE '%collectible%' OR COALESCE(NULLIF(specialty, ''), '') ILIKE '%contemporary african%' THEN specialty
      ELSE 'Collectible Furniture & Contemporary African Design' END,
    logo_url = COALESCE(NULLIF(logo_url, ''), 'https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_9.45.50_AM_ejpdtg.png')
WHERE id = '908c1661-0661-41ef-b3b4-14adbe6636ef';