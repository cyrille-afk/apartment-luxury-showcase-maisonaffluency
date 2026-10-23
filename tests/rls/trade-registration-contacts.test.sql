-- Execute the production trigger on a temporary profile row, using read-only
-- approved registration sources. No real account writes, signup or emails.
BEGIN;
-- Sandbox cannot execute private production triggers; clone the exact deployed
-- function body as an invoker-only temporary function using read-only sources.
SELECT replace(replace(pg_get_functiondef('public.fill_trade_registration_profile_contacts()'::regprocedure),
 'public.fill_trade_registration_profile_contacts()', 'pg_temp.fill_trade_registration_profile_contacts()'),
 'SECURITY DEFINER', 'SECURITY INVOKER') \gexec
CREATE TEMP TABLE contact_probe (id uuid, first_name text,last_name text,company text,phone text,country text);
CREATE TRIGGER contact_probe_fill BEFORE INSERT OR UPDATE ON contact_probe FOR EACH ROW EXECUTE FUNCTION pg_temp.fill_trade_registration_profile_contacts();
DO $$
DECLARE uid uuid; source public.trade_accounts%ROWTYPE; actual record; parts text[];
BEGIN
 SELECT a.* INTO source FROM public.trade_accounts a JOIN public.profiles p ON p.id=a.user_id
 WHERE a.status='approved' AND nullif(btrim(a.contact_name),'') IS NOT NULL AND nullif(btrim(a.studio_name),'') IS NOT NULL AND nullif(btrim(a.phone_number),'') IS NOT NULL AND nullif(btrim(a.country),'') IS NOT NULL
 AND a.id=(SELECT id FROM public.trade_accounts WHERE user_id=a.user_id AND status='approved' ORDER BY approved_at DESC NULLS LAST,created_at DESC,id LIMIT 1)
 ORDER BY a.created_at DESC LIMIT 1;
 uid:=source.user_id;
 IF uid IS NULL THEN RAISE EXCEPTION 'Requires a fully recorded linked approved registration'; END IF;
 parts:=regexp_split_to_array(btrim(source.contact_name),'\s+');
 INSERT INTO contact_probe VALUES(uid,'','',' ',NULL,'');
 SELECT * INTO actual FROM contact_probe WHERE id=uid;
 IF actual.first_name IS DISTINCT FROM parts[1] OR coalesce(actual.last_name,'') IS DISTINCT FROM coalesce(array_to_string(parts[2:array_length(parts,1)],' '),'') THEN RAISE EXCEPTION 'Registration name missing'; END IF;
 IF actual.company IS DISTINCT FROM btrim(source.studio_name) THEN RAISE EXCEPTION 'Registration company missing'; END IF;
 IF actual.phone IS DISTINCT FROM btrim(source.phone_number) THEN RAISE EXCEPTION 'Registration phone missing'; END IF;
 IF actual.country IS DISTINCT FROM btrim(source.country) THEN RAISE EXCEPTION 'Registration country missing'; END IF;
 UPDATE contact_probe SET first_name='Edited',last_name='Identity',company='User Studio',phone='+44 123456789',country='United Kingdom' WHERE id=uid;
 UPDATE contact_probe SET company=company WHERE id=uid;
 SELECT * INTO actual FROM contact_probe WHERE id=uid;
 IF actual.first_name IS DISTINCT FROM 'Edited' OR actual.last_name IS DISTINCT FROM 'Identity' OR actual.company IS DISTINCT FROM 'User Studio' OR actual.phone IS DISTINCT FROM '+44 123456789' OR actual.country IS DISTINCT FROM 'United Kingdom' THEN RAISE EXCEPTION 'User-edited contact details overwritten'; END IF;
 UPDATE contact_probe SET company=company WHERE id=uid;
 IF (SELECT phone FROM contact_probe WHERE id=uid) IS DISTINCT FROM '+44 123456789' THEN RAISE EXCEPTION 'Repeated handoff is not idempotent'; END IF;
 INSERT INTO contact_probe VALUES('00000000-0000-0000-0000-000000000000','Unlinked','Person','Unlinked Studio','+44 987654321','United Kingdom');
 IF (SELECT company FROM contact_probe WHERE id='00000000-0000-0000-0000-000000000000') IS DISTINCT FROM 'Unlinked Studio' THEN RAISE EXCEPTION 'Absent source erased saved details'; END IF;
 RAISE NOTICE 'All trade registration contact assertions passed';
END $$;
ROLLBACK;