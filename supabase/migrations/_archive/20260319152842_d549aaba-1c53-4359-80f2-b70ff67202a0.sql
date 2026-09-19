
ALTER TABLE public.presentation_slides 
ADD COLUMN slide_type text NOT NULL DEFAULT 'image',
ADD COLUMN room_section text NULL,
ADD COLUMN linked_product_ids jsonb NULL DEFAULT '[]'::jsonb,
ADD COLUMN linked_quote_id uuid NULL;
