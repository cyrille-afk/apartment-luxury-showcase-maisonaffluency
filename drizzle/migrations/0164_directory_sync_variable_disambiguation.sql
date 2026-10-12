CREATE OR REPLACE FUNCTION public.sync_approved_trade_directory(p_account_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
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
 IF cid IS NULL THEN SELECT c.id INTO cid FROM public.clients c WHERE c.studio_id=target.id AND c.onboarding_account_id IS NULL AND lower(trim(c.name))=lower(company) AND (NOT EXISTS(SELECT 1 FROM public.client_contacts cc WHERE cc.client_id=c.id) OR EXISTS(SELECT 1 FROM public.client_contacts cc WHERE cc.client_id=c.id AND lower(cc.email)=lower(a.email))) ORDER BY c.created_at,c.id LIMIT 1; END IF;
 IF cid IS NULL THEN INSERT INTO public.clients(studio_id,created_by,name,type,onboarding_account_id) VALUES(target.id,target.created_by,company,'studio',a.id) RETURNING id INTO cid; END IF;
 UPDATE public.clients SET name=company,website=coalesce(website,clients.website),tax_id=coalesce(nullif(trim(a.tax_vat_id),''),nullif(trim(l.tax_vat_id),''),clients.tax_id),billing_city=coalesce(city,clients.billing_city),billing_country=coalesce(country,clients.billing_country),default_currency=coalesce(nullif(trim(p.preferred_currency),''),clients.default_currency),onboarding_account_id=a.id,onboarding_details=details,onboarding_synced_at=now(),updated_at=now() WHERE id=cid;
 SELECT id INTO contactid FROM public.client_contacts WHERE client_id=cid AND onboarding_account_id=a.id;
 IF contactid IS NULL THEN SELECT id INTO contactid FROM public.client_contacts WHERE client_id=cid AND onboarding_account_id IS NULL AND lower(email)=lower(a.email) ORDER BY created_at,id LIMIT 1; END IF;
 IF contactid IS NULL THEN INSERT INTO public.client_contacts(client_id,first_name,last_name,email,is_primary,onboarding_account_id) VALUES(cid,firstn,lastn,a.email,NOT EXISTS(SELECT 1 FROM public.client_contacts WHERE client_id=cid AND is_primary),a.id) RETURNING id INTO contactid; END IF;
 UPDATE public.client_contacts SET first_name=firstn,last_name=lastn,email=a.email,phone=coalesce(phone,client_contacts.phone),role_title=coalesce(nullif(trim(a.job_title),''),nullif(trim(l.job_title),''),client_contacts.role_title),onboarding_account_id=a.id,updated_at=now() WHERE id=contactid;
 END LOOP;
END $$;