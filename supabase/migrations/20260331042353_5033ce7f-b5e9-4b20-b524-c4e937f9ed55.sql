
-- Publish all 32 existing unpublished designers
UPDATE designers SET is_published = true, updated_at = now() WHERE slug IN (
  'alpange', 'andrea-claire-studio', 'based-upon', 'bruno-moinard-editions',
  'dagmar-london', 'hom-le-xuan', 'iksel', 'jacob-hashimoto-studio',
  'jindrich-halabala', 'lobjet', 'le-berre-vevaud', 'lost-profile-studio',
  'michel-amar-studio', 'nicolas-aubagnac', 'noom', 'okurayama-studio',
  'ooumm', 'osanna-visconti', 'overgaard-dyrman', 'paul-cocksedge-studio',
  'peter-reed', 'pierre-augustin-rose', 'pierre-frey', 'pierre-yovanovitch',
  'pinton-1867', 'poltrona-frau', 'privatiselectionem', 'refractory-studio',
  'saint-louis', 'serge-mouille', 'simon-cabrol', 'valeria-nascimento'
);

-- Publish designers with slightly different names that are already in DB
UPDATE designers SET is_published = true, updated_at = now() WHERE slug IN (
  'articolo-studios', 'bryan-osullivan-studio', 'cazes-conquet',
  'celso-de-lemos', 'damien-langlois-meurinne', 'takayokaya'
);

-- Publish Maison WeCraft
UPDATE designers SET is_published = true, updated_at = now() WHERE name = 'Maison WeCraft';
