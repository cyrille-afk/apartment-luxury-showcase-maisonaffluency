CREATE TABLE public.trade_directory_targets (studio_id uuid PRIMARY KEY REFERENCES public.studios(id),created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.trade_directory_targets TO service_role;
ALTER TABLE public.trade_directory_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ADD COLUMN onboarding_account_id uuid REFERENCES public.trade_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN onboarding_details jsonb;
ALTER TABLE public.clients ADD COLUMN onboarding_synced_at timestamptz;
ALTER TABLE public.client_contacts ADD COLUMN onboarding_account_id uuid REFERENCES public.trade_accounts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX clients_onboarding_account_unique ON public.clients(studio_id,onboarding_account_id) WHERE onboarding_account_id IS NOT NULL;
CREATE UNIQUE INDEX contacts_onboarding_account_unique ON public.client_contacts(client_id,onboarding_account_id) WHERE onboarding_account_id IS NOT NULL;
CREATE FUNCTION public.sync_approved_trade_directory(p_account_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.trade_accounts%ROWTYPE; p public.profiles%ROWTYPE; l public.trade_applications%ROWTYPE; s public.trade_program_signups%ROWTYPE; target record; cid uuid; contactid uuid; firstn text; lastn text; parts text[]; company text; website text; phone text; country text; city text; details jsonb;
BEGIN
 SELECT * INTO a FROM public.trade_accounts WHERE id=p_account_id;
 IF NOT FOUND OR a.status <> 'approved' THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('trade-directory:'||a.id::text,0));
 SELECT * INTO p FROM public.profiles WHERE id=a.user_id OR (a.user_id IS NULL AND lower(email)=lower(a.email)) ORDER BY id LIMIT 1;
 SELECT * INTO l FROM public.trade_applications WHERE id=a.legacy_application_id;
 SELECT * INTO s FROM public.trade_program_signups WHERE id=a.signup_id;
 company:=coalesce(nullif(trim(a.studio_name),''),nullif(trim(l.company_name),''),nullif(trim(p.company),''),a.email);
 parts:=regexp_split_to_array(trim(coalesce(a.contact_name,'')),'\s+');
 firstn:=coalesce(nullif(trim(p.first_name),''),parts[1],''); lastn:=coalesce(nullif(trim(p.last_name),''),array_to_string(parts[2:array_length(parts,1)],' '),'');
 website:=coalesce(nullif(trim(a.website_or_ig),''),nullif(trim(l.company_website),''),nullif(trim(s.website_url),''));
 IF website IS NOT NULL AND website !~* '^https?://' THEN website:='https://'||website; END IF;
 phone:=coalesce(nullif(trim(a.phone_number),''),nullif(trim(p.phone),''),nullif(trim(s.phone_number),''));
 country:=coalesce(nullif(trim(a.country),''),nullif(trim(l.country),''),nullif(trim(p.country),'')); city:=coalesce(nullif(trim(a.city),''),nullif(trim(l.city),''));
 details:=jsonb_strip_nulls(jsonb_build_object('status',a.status,'business_registration',coalesce(nullif(trim(a.business_reg_number),''),nullif(trim(l.corporate_reg_number),''),nullif(trim(s.business_reg_number),'')),'instagram',coalesce(nullif(trim(a.instagram_handle),''),nullif(trim(l.instagram_handle),'')),'portfolio_reference',s.portfolio_reference,'source',a.source,'intent',a.intent,'message',l.message,'certification_details',l.certification_details,'certified_professional',l.is_certified_professional,'credential_on_file',coalesce(a.credential_document_path,l.credential_document_path,s.credential_document_path) IS NOT NULL,'tax_exempt_status',l.tax_exempt_status,'submitted_at',a.created_at,'approved_at',a.approved_at));
 FOR target IN SELECT st.id,st.created_by FROM public.trade_directory_targets t JOIN public.studios st ON st.id=t.studio_id WHERE public.has_role(st.created_by,'admin') OR public.has_role(st.created_by,'super_admin') LOOP
 SELECT id INTO cid FROM public.clients WHERE studio_id=target.id AND onboarding_account_id=a.id;
 IF cid IS NULL THEN
 SELECT c.id INTO cid FROM public.clients c WHERE c.studio_id=target.id AND c.onboarding_account_id IS NULL AND lower(trim(c.name))=lower(company) AND (NOT EXISTS(SELECT 1 FROM public.client_contacts cc WHERE cc.client_id=c.id) OR EXISTS(SELECT 1 FROM public.client_contacts cc WHERE cc.client_id=c.id AND lower(cc.email)=lower(a.email))) ORDER BY c.created_at,c.id LIMIT 1;
 END IF;
 IF cid IS NULL THEN INSERT INTO public.clients(studio_id,created_by,name,type,onboarding_account_id) VALUES(target.id,target.created_by,company,'studio',a.id) RETURNING id INTO cid; END IF;
 UPDATE public.clients SET name=company,website=coalesce(website,clients.website),tax_id=coalesce(nullif(trim(a.tax_vat_id),''),nullif(trim(l.tax_vat_id),''),clients.tax_id),billing_city=coalesce(city,clients.billing_city),billing_country=coalesce(country,clients.billing_country),default_currency=coalesce(nullif(trim(p.preferred_currency),''),clients.default_currency),onboarding_account_id=a.id,onboarding_details=details,onboarding_synced_at=now(),updated_at=now() WHERE id=cid;
 SELECT id INTO contactid FROM public.client_contacts WHERE client_id=cid AND onboarding_account_id=a.id;
 IF contactid IS NULL THEN SELECT id INTO contactid FROM public.client_contacts WHERE client_id=cid AND onboarding_account_id IS NULL AND lower(email)=lower(a.email) ORDER BY created_at,id LIMIT 1; END IF;
 IF contactid IS NULL THEN INSERT INTO public.client_contacts(client_id,first_name,last_name,email,is_primary,onboarding_account_id) VALUES(cid,firstn,lastn,a.email,NOT EXISTS(SELECT 1 FROM public.client_contacts WHERE client_id=cid AND is_primary),a.id) RETURNING id INTO contactid; END IF;
 UPDATE public.client_contacts SET first_name=firstn,last_name=lastn,email=a.email,phone=coalesce(phone,client_contacts.phone),role_title=coalesce(nullif(trim(a.job_title),''),nullif(trim(l.job_title),''),client_contacts.role_title),onboarding_account_id=a.id,updated_at=now() WHERE id=contactid;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.sync_approved_trade_directory(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_approved_trade_directory(uuid) TO service_role;
CREATE FUNCTION public.trade_directory_sync_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid;
BEGIN
 IF TG_TABLE_NAME='trade_accounts' THEN PERFORM public.sync_approved_trade_directory(NEW.id);
 ELSIF TG_TABLE_NAME='profiles' THEN FOR aid IN SELECT id FROM public.trade_accounts WHERE status='approved' AND (user_id=NEW.id OR (user_id IS NULL AND lower(email)=lower(NEW.email))) LOOP PERFORM public.sync_approved_trade_directory(aid); END LOOP;
 ELSIF TG_TABLE_NAME='trade_applications' THEN FOR aid IN SELECT id FROM public.trade_accounts WHERE status='approved' AND legacy_application_id=NEW.id LOOP PERFORM public.sync_approved_trade_directory(aid); END LOOP;
 ELSE FOR aid IN SELECT id FROM public.trade_accounts WHERE status='approved' AND signup_id=NEW.id LOOP PERFORM public.sync_approved_trade_directory(aid); END LOOP;
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trade_directory_sync_trigger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trade_accounts_directory_sync AFTER INSERT OR UPDATE OF status,user_id,email,studio_name,contact_name,website_or_ig,phone_number,job_title,country,city,instagram_handle,tax_vat_id,business_reg_number,credential_document_path,signup_id,legacy_application_id,source,intent ON public.trade_accounts FOR EACH ROW EXECUTE FUNCTION public.trade_directory_sync_trigger();
CREATE TRIGGER profiles_directory_sync AFTER INSERT OR UPDATE OF first_name,last_name,phone,email,company,country,preferred_currency ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trade_directory_sync_trigger();
CREATE TRIGGER applications_directory_details_sync AFTER UPDATE OF company_name,company_website,job_title,country,city,instagram_handle,tax_vat_id,corporate_reg_number,message,certification_details,credential_document_path ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.trade_directory_sync_trigger();
CREATE TRIGGER signups_directory_details_sync AFTER UPDATE OF portfolio_reference,phone_number,website_url,business_reg_number,credential_document_path ON public.trade_program_signups FOR EACH ROW EXECUTE FUNCTION public.trade_directory_sync_trigger();
CREATE OR REPLACE FUNCTION public.sync_trade_application_to_admin_directory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid;
BEGIN FOR aid IN SELECT id FROM public.trade_accounts WHERE status='approved' AND legacy_application_id=NEW.id LOOP PERFORM public.sync_approved_trade_directory(aid); END LOOP; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.get_client_contacts_safe(_client_id uuid) RETURNS TABLE(id uuid,client_id uuid,first_name text,last_name text,role_title text,email text,phone text,is_primary boolean,notes text,created_at timestamptz,updated_at timestamptz,can_edit boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; editable boolean; synced boolean;
BEGIN
 SELECT c.studio_id,c.onboarding_details IS NOT NULL INTO sid,synced FROM public.clients c WHERE c.id=_client_id;
 IF sid IS NULL THEN RETURN; END IF;
 IF synced AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN RETURN; END IF;
 editable:=public.can_edit_studio(auth.uid(),sid);
 IF NOT (editable OR public.can_view_studio(auth.uid(),sid)) THEN RETURN; END IF;
 RETURN QUERY SELECT cc.id,cc.client_id,cc.first_name,cc.last_name,cc.role_title,CASE WHEN editable OR cc.email IS NULL OR cc.email='' THEN cc.email ELSE regexp_replace(cc.email,'(^.).*(@.*$)','\1•••\2') END,CASE WHEN editable OR cc.phone IS NULL OR cc.phone='' THEN cc.phone ELSE regexp_replace(cc.phone,'.(?=.{2})','•','g') END,cc.is_primary,CASE WHEN editable THEN cc.notes ELSE NULL END,cc.created_at,cc.updated_at,editable FROM public.client_contacts cc WHERE cc.client_id=_client_id ORDER BY cc.is_primary DESC NULLS LAST,cc.created_at;
END $$;
REVOKE ALL ON FUNCTION public.upsert_admin_directory_client(uuid,uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_admin_directory_client(uuid,uuid,text,text,text,text,text,text,text) TO service_role;
CREATE POLICY "Synced directory admin boundary" ON public.clients AS RESTRICTIVE FOR ALL TO authenticated USING (onboarding_details IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (onboarding_details IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Synced contacts admin boundary" ON public.client_contacts AS RESTRICTIVE FOR ALL TO authenticated USING (onboarding_account_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (onboarding_account_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));