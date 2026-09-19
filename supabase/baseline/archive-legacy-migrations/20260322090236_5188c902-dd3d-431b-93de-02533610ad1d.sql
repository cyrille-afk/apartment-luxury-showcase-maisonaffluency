-- Move the Resources hero banner to Designers & Ateliers Library
UPDATE section_heroes
SET section_key = 'designers'
WHERE section_key = 'documents';
