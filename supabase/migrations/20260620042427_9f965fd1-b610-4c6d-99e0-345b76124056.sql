UPDATE designer_curator_picks
SET gallery_images = array_append(gallery_images, 'https://res.cloudinary.com/dif1oamtj/image/upload/v1772085743/dining-room_ey0bu5.jpg')
WHERE id = '0f9fa966-43cf-49bd-a383-bbcc0e600ebb'
  AND NOT ('https://res.cloudinary.com/dif1oamtj/image/upload/v1772085743/dining-room_ey0bu5.jpg' = ANY(gallery_images));