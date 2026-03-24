
UPDATE public.designers
SET biography = regexp_replace(
  biography,
  'https://s30964\.p1087\.sites\.pressdns\.com/wp-content/uploads/2017/08/APPARATUS-PORTRAIT-2\.jpg \| Gabriel Hendifar & Jeremy Anderson — Photo: Wichmann \+ Bendtsen',
  'https://s30964.pcdn.co/introspective-magazine/wp-content/uploads/2017/08/APPARATUS_SALONE2017_04.jpg | Milan Showroom — Lantern & Portal Dining Table — Photo: Paola Pansini'
),
biography_images = ARRAY[
  'https://s30964.p1087.sites.pressdns.com/wp-content/uploads/2017/08/APPARATUS-PORTRAIT-2.jpg | Gabriel Hendifar & Jeremy Anderson — Photo: Wichmann + Bendtsen',
  'https://s30964.pcdn.co/introspective-magazine/wp-content/uploads/2017/08/APPARATUS_Manhattan-showroom.jpg | Chelsea Headquarters — Entrance Gallery — Photo: Wichmann + Bendtsen',
  'https://images.surfacemag.com/app/uploads/2018/08/06174930/Apparatus_Stills_Print-13-2000x1334.jpg | Cloud Pendant detail — Photo: Kelsey Allen / Surface Magazine',
  'https://media.architecturaldigest.com/photos/57a2085da065cffc07e866c7/master/w_1600,c_limit/0916-apparatus-lighting-3.jpg | Workshop — Craftsmen assembling fixtures — Photo: Architectural Digest',
  'https://cdn.mos.cms.futurecdn.net/YL7i5uEkCePrSSDKjSFH8Y.jpg | London Gallery Interior — Photo: Matthew Placek / Wallpaper*',
  'https://apparatusstudio.com/cdn/shop/files/APPARATUS_ABOUT_07.jpg?v=1761232754&width=3000 | In-situ — Sofa & Pendants — Photo: Apparatus Studio',
  'https://hips.hearstapps.com/hmg-prod/images/apparatus-studio-ed-skj-03-1650415302.jpg | Studio entry gallery — Photo: Stephen Kent Johnson / Elle Decor',
  'https://estliving.com/wp-content/uploads/2019/03/est-living-apparatus-studio-interview-la-showroom-6.webp | LA Showroom — Monastic interior — Photo: est living',
  'https://apparatusstudio.com/cdn/shop/files/APPARATUS_ABOUT_03.jpg?v=1761232208&width=3000 | Craftsman with glass — Photo: Apparatus Studio',
  'https://apparatusstudio.com/cdn/shop/files/APPARATUS_ABOUT_10.jpg?v=1761232955&width=3000 | Gabriel Hendifar — Photo: Apparatus Studio'
],
updated_at = now()
WHERE slug = 'apparatus-studio';
