
-- 1. Remove duplicate subtitle from Stone E Floor Lamp and Stone C Table Lamp
UPDATE designer_curator_picks SET subtitle = NULL WHERE id IN ('b8bf9198-8b05-4d23-ac61-b6d8a2cf8ed1', 'df2d32a7-10f8-4152-9aec-6c2fe9de8e9e');

-- 2. Rename "Stone Floor Lamp" to "Stone E Floor Lamp"
UPDATE designer_curator_picks SET title = 'Stone E Floor Lamp' WHERE id = 'dd83152a-8fcf-4e34-9cab-ac5bb545214e';
