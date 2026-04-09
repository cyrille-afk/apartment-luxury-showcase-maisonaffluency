
UPDATE designers SET
  biography = REPLACE(
    biography,
    'for Andrée Putman',
    'for <a href="/designer/andree-putman">Andrée Putman</a>'
  )
WHERE id = 'f8ba5da1-e45f-45d9-a7ad-68fefc1df006';

UPDATE designers SET
  biography = REPLACE(
    biography,
    'alongside Andrée Putman',
    'alongside <a href="/designer/andree-putman">Andrée Putman</a>'
  )
WHERE id = '81a2a7fd-ec96-45b8-9043-8862a7cf2922';
