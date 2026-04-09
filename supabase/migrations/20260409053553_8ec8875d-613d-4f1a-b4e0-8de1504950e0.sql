
UPDATE designers SET
  biography = REPLACE(
    REPLACE(
      biography,
      'at Ecart International, where',
      'at <a href="/designer/ecart">Ecart International</a>, where'
    ),
    'Ecart International alongside Andrée Putman',
    '<a href="/designer/ecart">Ecart International</a> alongside <a href="/designer/andree-putman">Andrée Putman</a>'
  )
WHERE id IN ('f8ba5da1-e45f-45d9-a7ad-68fefc1df006', '81a2a7fd-ec96-45b8-9043-8862a7cf2922');
