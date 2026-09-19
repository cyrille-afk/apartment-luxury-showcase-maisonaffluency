UPDATE designers
SET biography = REPLACE(
  biography,
  'https://www.instagram.com/reel/DCYSczFN7ov/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ== | A behind-the-scenes look at the making of casamuseo project for @collezionettoremoliranio and @colombinaros',
  'https://www.instagram.com/reel/DCYSczFN7ov/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ== | A behind-the-scenes look at the making of casamuseo project for @collezionettoremoliranio and @colombinaros | poster:https://res.cloudinary.com/dif1oamtj/image/upload/v1780286794/lazzarini-pickering-reel-cover_i48yyd.jpg'
)
WHERE slug = 'lazzarini-pickering';