UPDATE designers 
SET biography = replace(
  biography, 
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1774612463/SIL-Bonney-ILV034-A_-_The_Regents_of_the_University_of_California_The_Bancroft_Library_Universit_cohcy2.jpg',
  'https://res.cloudinary.com/dif1oamtj/image/upload/v1774612463/SIL-Bonney-ILV034-A_-_The_Regents_of_the_University_of_California_The_Bancroft_Library_Universit_cohcy2.jpg | The Regents of the University of California, The Bancroft Library | small'
)
WHERE slug = 'jean-michel-frank';