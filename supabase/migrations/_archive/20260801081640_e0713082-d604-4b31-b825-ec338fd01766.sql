CREATE TABLE IF NOT EXISTS public.personal_email_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.personal_email_domains TO authenticated;
GRANT ALL ON public.personal_email_domains TO service_role;

ALTER TABLE public.personal_email_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage personal email domains" ON public.personal_email_domains;
CREATE POLICY "Admins manage personal email domains"
ON public.personal_email_domains FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.personal_email_domains (domain) VALUES
  ('gmail.com'),('googlemail.com'),('yahoo.com'),('yahoo.co.uk'),('yahoo.fr'),('ymail.com'),
  ('hotmail.com'),('hotmail.co.uk'),('hotmail.fr'),('outlook.com'),('outlook.fr'),('live.com'),
  ('live.co.uk'),('msn.com'),('icloud.com'),('me.com'),('mac.com'),('aol.com'),
  ('proton.me'),('protonmail.com'),('pm.me'),('gmx.com'),('gmx.de'),('gmx.net'),
  ('web.de'),('mail.com'),('mail.ru'),('yandex.com'),('yandex.ru'),('zoho.com'),
  ('fastmail.com'),('hey.com'),('tutanota.com'),('tuta.io'),('inbox.com'),('rocketmail.com'),
  ('comcast.net'),('verizon.net'),('sbcglobal.net'),('bellsouth.net'),('btinternet.com'),
  ('orange.fr'),('wanadoo.fr'),('free.fr'),('sfr.fr'),('laposte.net'),('qq.com'),
  ('163.com'),('126.com'),('naver.com'),('hanmail.net'),('daum.net'),('rediffmail.com')
ON CONFLICT (domain) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_personal_email_domain(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.personal_email_domains d
    WHERE lower(split_part(_email, '@', 2)) = d.domain
       OR lower(split_part(_email, '@', 2)) LIKE '%.' || d.domain
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_trade_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    user_email TEXT;
    assigned_status TEXT;
BEGIN
    user_email := LOWER(NEW.email);

    -- Auto-approval is only ever possible for a CONFIRMED corporate mailbox.
    -- Personal / free mailbox providers always require admin approval.
    IF NEW.email_confirmed_at IS NULL
       OR user_email IS NULL
       OR position('@' in user_email) = 0
       OR public.is_personal_email_domain(user_email) THEN
        assigned_status := 'pending_review';
    ELSE
        assigned_status := 'approved';
    END IF;

    PERFORM set_config('app.bypass_profile_guard', 'on', true);

    INSERT INTO public.profiles (id, email, trade_status)
    VALUES (NEW.id, user_email, assigned_status)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          trade_status = CASE
            WHEN public.profiles.trade_status = 'approved' THEN 'approved'
            ELSE EXCLUDED.trade_status
          END;

    PERFORM set_config('app.bypass_profile_guard', 'off', true);

    RETURN NEW;
END;
$function$;