-- Real trigger regression, entirely rolled back; no signup/email or persistent fixtures.
BEGIN;
DO $$
DECLARE uid uuid; aid uuid; actual public.profiles%ROWTYPE;
BEGIN
 SELECT p.id INTO uid FROM public.profiles p JOIN public.trade_accounts a ON a.user_id=p.id WHERE a.status='approved' ORDER BY a.created_at DESC LIMIT 1;
 IF uid IS NULL THEN RAISE EXCEPTION 'Requires a linked approved account fixture'; END IF;
 SELECT id INTO aid FROM public.trade_accounts WHERE user_id=uid AND status='approved' ORDER BY approved_at DESC NULLS LAST,created_at DESC,id LIMIT 1;
 UPDATE public.trade_accounts SET contact_name='Alex Test Partner',studio_name='Contact Handoff Studio',phone_number='+65 8123 4567',country='Singapore' WHERE id=aid;
 UPDATE public.profiles SET first_name='',last_name='',company=' ',phone=NULL,country='' WHERE id=uid;
 SELECT * INTO actual FROM public.profiles WHERE id=uid;
 IF actual.first_name IS DISTINCT FROM 'Alex' OR actual.last_name IS DISTINCT FROM 'Test Partner' THEN RAISE EXCEPTION 'Registration name missing'; END IF;
 IF actual.company IS DISTINCT FROM 'Contact Handoff Studio' THEN RAISE EXCEPTION 'Registration company missing'; END IF;
 IF actual.phone IS DISTINCT FROM '+65 8123 4567' THEN RAISE EXCEPTION 'Registration phone missing'; END IF;
 IF actual.country IS DISTINCT FROM 'Singapore' THEN RAISE EXCEPTION 'Registration country missing'; END IF;
 UPDATE public.profiles SET first_name='Edited',last_name='Identity',company='User Studio',phone='+44 123456789',country='United Kingdom' WHERE id=uid;
 UPDATE public.trade_accounts SET phone_number='+65 8999 9999' WHERE id=aid;
 SELECT * INTO actual FROM public.profiles WHERE id=uid;
 IF actual.first_name IS DISTINCT FROM 'Edited' OR actual.last_name IS DISTINCT FROM 'Identity' OR actual.company IS DISTINCT FROM 'User Studio' OR actual.phone IS DISTINCT FROM '+44 123456789' OR actual.country IS DISTINCT FROM 'United Kingdom' THEN RAISE EXCEPTION 'User-edited contact details overwritten'; END IF;
 UPDATE public.trade_accounts SET phone_number=phone_number WHERE id=aid;
 IF (SELECT phone FROM public.profiles WHERE id=uid) IS DISTINCT FROM '+44 123456789' THEN RAISE EXCEPTION 'Repeated handoff is not idempotent'; END IF;
 -- Missing incoming data must never erase an existing value.
 UPDATE public.trade_accounts SET phone_number=NULL,studio_name=NULL,contact_name=NULL,country=NULL WHERE id=aid;
 IF (SELECT company FROM public.profiles WHERE id=uid) IS DISTINCT FROM 'User Studio' THEN RAISE EXCEPTION 'Empty source erased saved details'; END IF;
 RAISE NOTICE 'All trade registration contact assertions passed';
END $$;
ROLLBACK;