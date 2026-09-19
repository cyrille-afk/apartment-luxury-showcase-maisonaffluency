UPDATE designer_curator_picks
SET gallery_images = ARRAY[
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1777344138/APPARATUS_-_LANTERN_TABLE_LAMP_A_tkuzkp.jpg',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1777342983/Screen_Shot_2026-04-28_at_10.22.42_AM_iobxks.png',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1777344137/APPARATUS_-_LANTERN_TABLE_LAMP_cnpjw3.jpg',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1777342920/Screen_Shot_2026-04-28_at_10.19.51_AM_npgewh.png',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1777344137/APPARATUS_-_LANTERN_TABLE_LAMP_-_AGIANST_BLACK_wvlhjt.jpg',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1777342919/Screen_Shot_2026-04-28_at_10.20.00_AM_osz0ff.png',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1777342920/Screen_Shot_2026-04-28_at_10.20.07_AM_us0fdp.png',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1784170237/WhatsApp_Image_2026-07-16_at_10.49.16_AM_j4ocgl.jpg'
],
variant_image_map = '{"agedbrasswaxed|slipcastporcelain":0,"agedbrasswaxed":0,"slipcastporcelain":0,"tarnishedsilver":2,"tarnishedsilverlacquered":2,"tarnishedsilverlacquered|slipcastporcelain":2}'::jsonb
WHERE id = 'be988b38-e8f9-402d-a7f1-7d8ffad9fae2';