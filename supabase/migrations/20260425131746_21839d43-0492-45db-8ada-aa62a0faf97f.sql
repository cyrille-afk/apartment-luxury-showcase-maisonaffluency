UPDATE designers
SET biography = replace(
  biography,
  'https://videos.fashionnetwork.com/en/PMV20055_EN.mp4 | French Touch : Thierry Lemaire, the designer that seduced Macron - courtesy of Fashion Network',
  'https://videos.fashionnetwork.com/en/PMV20055_EN.mp4 | French Touch : Thierry Lemaire, the designer that seduced Macron - courtesy of Fashion Network | poster:/images/thierry-lemaire-video-poster.jpg'
)
WHERE slug = 'thierry-lemaire';