UPDATE public.onboarding_tour_steps
SET sort_order = sort_order + 10,
    title = CASE step_key
      WHEN 'showroom'  THEN '2. Browse the Showroom'
      WHEN 'designers' THEN '3. Discover Designers & Ateliers'
      WHEN 'brief'     THEN '4. Set up a brief'
      WHEN 'tools'     THEN '5. Your specification toolkit'
      ELSE title
    END
WHERE step_key IN ('showroom', 'designers', 'brief', 'tools');

INSERT INTO public.onboarding_tour_steps
  (step_key, title, body, path, icon, cta_label, sort_order, is_active)
VALUES (
  'install-phone',
  '1. Install Maison Affluency on your phone',
  'Add Maison Affluency to your iPhone or Android home screen so the trade portal opens like a native app — instant access to your projects, quotes and spec sheets, anywhere on site.',
  '/trade/guides/pwa-preview-checklist',
  'Smartphone',
  'Next: Showroom',
  10,
  true
)
ON CONFLICT (step_key) DO UPDATE
  SET title = EXCLUDED.title,
      body = EXCLUDED.body,
      path = EXCLUDED.path,
      icon = EXCLUDED.icon,
      cta_label = EXCLUDED.cta_label,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active;