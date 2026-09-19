CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_admins_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := supabase_url || '/functions/v1/notify-new-order',
      body := jsonb_build_object(
        'product_name', NEW.product_name,
        'selected_finish', NEW.selected_finish,
        'amount_total', NEW.amount_total,
        'currency', NEW.currency,
        'customer_email', NEW.customer_email,
        'transaction_id', NEW.transaction_id,
        'status', NEW.status,
        'created_at', NEW.created_at
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admins_new_order_trigger ON public.orders;

CREATE TRIGGER notify_admins_new_order_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
WHEN (lower(NEW.status) IN ('completed', 'paid'))
EXECUTE FUNCTION public.notify_admins_new_order();