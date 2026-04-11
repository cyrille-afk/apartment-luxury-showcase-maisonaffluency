
CREATE OR REPLACE FUNCTION public.notify_admins_production_render(
  _render_title text,
  _engine text,
  _requester_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      admin_record.user_id,
      'Production Render Requested',
      _requester_name || ' requested a ' || _engine || ' render: ' || _render_title,
      'production_render',
      '/trade/quotes'
    );
  END LOOP;
END;
$$;
