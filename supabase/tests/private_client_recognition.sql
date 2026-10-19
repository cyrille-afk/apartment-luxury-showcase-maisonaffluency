-- Run in a rollback-only privileged test transaction; no emails or orders sent.
BEGIN;
DO $$
DECLARE c jsonb; c2 jsonb; n integer;
BEGIN
 IF has_table_privilege('anon','public.private_client_challenges','SELECT') OR has_function_privilege('authenticated','public.private_client_has_activity(text,text)','EXECUTE') THEN RAISE EXCEPTION 'Recognition is exposed'; END IF;
 c := public.private_client_code_request('recognition-test@example.invalid','test-ip');
 IF c IS NULL THEN RAISE EXCEPTION 'Missing challenge'; END IF;
 IF public.private_client_code_verify((c->>'id')::uuid,'other@example.invalid',c->>'code') THEN RAISE EXCEPTION 'Email scope failed'; END IF;
 IF NOT public.private_client_code_verify((c->>'id')::uuid,'recognition-test@example.invalid',c->>'code') THEN RAISE EXCEPTION 'Valid code failed'; END IF;
 IF public.private_client_code_verify((c->>'id')::uuid,'recognition-test@example.invalid',c->>'code') THEN RAISE EXCEPTION 'Code replay succeeded'; END IF;
 c2 := public.private_client_code_request('recognition-expiry@example.invalid','test-ip');
 UPDATE public.private_client_challenges SET expires_at=now()-interval '1 second' WHERE id=(c2->>'id')::uuid;
 IF public.private_client_code_verify((c2->>'id')::uuid,'recognition-expiry@example.invalid',c2->>'code') THEN RAISE EXCEPTION 'Expired code succeeded'; END IF;
 c2 := public.private_client_code_request('recognition-attempts@example.invalid','test-ip');
 FOR n IN 1..5 LOOP
  PERFORM public.private_client_code_verify((c2->>'id')::uuid,'recognition-attempts@example.invalid','invalid');
 END LOOP;
 IF public.private_client_code_verify((c2->>'id')::uuid,'recognition-attempts@example.invalid',c2->>'code') THEN RAISE EXCEPTION 'Attempt limit failed'; END IF;
 IF public.private_client_code_request('recognition-attempts@example.invalid','test-ip') IS NOT NULL THEN RAISE EXCEPTION 'Resend wait failed'; END IF;
 INSERT INTO public.abandoned_carts(session_id,email,buyer_profile,item_count,items,status) VALUES ('recognition-cart','recognition-test@example.invalid','private',1,'[]','active');
 IF NOT public.private_client_has_activity('recognition-test@example.invalid',NULL) THEN RAISE EXCEPTION 'Abandoned private basket not recognized'; END IF;
 IF public.private_client_has_activity('recognition-test@example.invalid','recognition-cart') THEN RAISE EXCEPTION 'Current basket self-recognized'; END IF;
 UPDATE public.abandoned_carts SET buyer_profile='designer' WHERE session_id='recognition-cart';
 IF public.private_client_has_activity('recognition-test@example.invalid',NULL) THEN RAISE EXCEPTION 'Professional basket recognized'; END IF;
 INSERT INTO public.shop_orders(order_ref,email,buyer_type,status,currency,subtotal_cents,shipping_cents,total_cents,payment_method,paid_at) VALUES ('recognition-test','recognition-test@example.invalid','private','paid','EUR',100,0,100,'card',now());
 IF NOT public.private_client_has_activity('recognition-test@example.invalid',NULL) THEN RAISE EXCEPTION 'Paid private order not recognized'; END IF;
  UPDATE public.shop_orders SET status='cancelled' WHERE order_ref='recognition-test';
  IF public.private_client_has_activity('recognition-test@example.invalid',NULL) THEN RAISE EXCEPTION 'Cancelled order recognized'; END IF;
  IF has_function_privilege('authenticated','public.private_client_optin(text)','EXECUTE') OR has_function_privilege('anon','public.private_client_optin(text)','EXECUTE') THEN RAISE EXCEPTION 'Opt-in exposed'; END IF;
  PERFORM public.private_client_optout('recognition-optin@example.invalid');
  IF NOT EXISTS (SELECT 1 FROM public.private_client_recognition_optouts WHERE email_hash=encode(digest('recognition-optin@example.invalid','sha256'),'hex')) THEN RAISE EXCEPTION 'Opt-out not recorded'; END IF;
  PERFORM public.private_client_optin('Recognition-Optin@example.invalid ');
  IF EXISTS (SELECT 1 FROM public.private_client_recognition_optouts WHERE email_hash=encode(digest('recognition-optin@example.invalid','sha256'),'hex')) THEN RAISE EXCEPTION 'Opt-in did not remove opt-out'; END IF;
END $$;
ROLLBACK;