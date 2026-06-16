
ALTER TABLE public.designer_curator_picks_public
  ADD COLUMN IF NOT EXISTS wood_label_override TEXT;

CREATE OR REPLACE FUNCTION public.sync_designer_curator_picks_public()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.designer_curator_picks_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.is_hidden, false) = false THEN
    INSERT INTO public.designer_curator_picks_public (
      id, designer_id, image_url, hover_image_url, title, subtitle, category,
      subcategory, tags, materials, dimensions, description, edition,
      photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order, created_at,
      currency, lead_time, price_prefix, gallery_images, origin, size_variants,
      variant_placeholder, base_axis_label, top_axis_label, variant_image_map,
      is_hidden, edition_number, edition_signing, pack_cbm, pack_weight_kg,
      pack_carton_count, default_ship_mode, pickup_country, pickup_postcode,
      pickup_address, materials_description, gallery_captions, is_upholstered,
      wood_label_override
    ) VALUES (
      NEW.id, NEW.designer_id, NEW.image_url, NEW.hover_image_url, NEW.title,
      NEW.subtitle, NEW.category, NEW.subcategory, NEW.tags, NEW.materials,
      NEW.dimensions, NEW.description, NEW.edition, NEW.photo_credit,
      NEW.pdf_url, NEW.pdf_filename, NEW.pdf_urls, NEW.sort_order,
      NEW.created_at, NEW.currency, NEW.lead_time, NEW.price_prefix,
      NEW.gallery_images, NEW.origin, public.strip_public_variant_prices(NEW.size_variants), NEW.variant_placeholder,
      NEW.base_axis_label, NEW.top_axis_label, NEW.variant_image_map,
      NEW.is_hidden, NEW.edition_number, NEW.edition_signing, NEW.pack_cbm,
      NEW.pack_weight_kg, NEW.pack_carton_count, NEW.default_ship_mode,
      NEW.pickup_country, NEW.pickup_postcode, NEW.pickup_address,
      NEW.materials_description, NEW.gallery_captions, NEW.is_upholstered,
      NEW.wood_label_override
    )
    ON CONFLICT (id) DO UPDATE SET
      designer_id = EXCLUDED.designer_id,
      image_url = EXCLUDED.image_url,
      hover_image_url = EXCLUDED.hover_image_url,
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      tags = EXCLUDED.tags,
      materials = EXCLUDED.materials,
      dimensions = EXCLUDED.dimensions,
      description = EXCLUDED.description,
      edition = EXCLUDED.edition,
      photo_credit = EXCLUDED.photo_credit,
      pdf_url = EXCLUDED.pdf_url,
      pdf_filename = EXCLUDED.pdf_filename,
      pdf_urls = EXCLUDED.pdf_urls,
      sort_order = EXCLUDED.sort_order,
      created_at = EXCLUDED.created_at,
      currency = EXCLUDED.currency,
      lead_time = EXCLUDED.lead_time,
      price_prefix = EXCLUDED.price_prefix,
      gallery_images = EXCLUDED.gallery_images,
      origin = EXCLUDED.origin,
      size_variants = EXCLUDED.size_variants,
      variant_placeholder = EXCLUDED.variant_placeholder,
      base_axis_label = EXCLUDED.base_axis_label,
      top_axis_label = EXCLUDED.top_axis_label,
      variant_image_map = EXCLUDED.variant_image_map,
      is_hidden = EXCLUDED.is_hidden,
      edition_number = EXCLUDED.edition_number,
      edition_signing = EXCLUDED.edition_signing,
      pack_cbm = EXCLUDED.pack_cbm,
      pack_weight_kg = EXCLUDED.pack_weight_kg,
      pack_carton_count = EXCLUDED.pack_carton_count,
      default_ship_mode = EXCLUDED.default_ship_mode,
      pickup_country = EXCLUDED.pickup_country,
      pickup_postcode = EXCLUDED.pickup_postcode,
      pickup_address = EXCLUDED.pickup_address,
      materials_description = EXCLUDED.materials_description,
      gallery_captions = EXCLUDED.gallery_captions,
      is_upholstered = EXCLUDED.is_upholstered,
      wood_label_override = EXCLUDED.wood_label_override;
  ELSE
    DELETE FROM public.designer_curator_picks_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill from source
UPDATE public.designer_curator_picks_public p
SET wood_label_override = s.wood_label_override
FROM public.designer_curator_picks s
WHERE p.id = s.id AND s.wood_label_override IS NOT NULL;
