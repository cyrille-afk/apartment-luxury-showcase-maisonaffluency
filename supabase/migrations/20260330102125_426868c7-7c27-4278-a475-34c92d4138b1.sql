UPDATE designers SET biography = replace(
  biography,
  'https://christopherboots.com/wp-content/uploads/2022/05/CHRISTOPHER_BOOTS_OURANOS_I_DETAIL_3web_270522-700x505.jpg',
  'https://christopherboots.com/wp-content/uploads/2022/05/CHRISTOPHER_BOOTS_OURANOS_I_DETAIL_3web_270522-700x505.jpg | '
) WHERE slug = 'christopher-boots';