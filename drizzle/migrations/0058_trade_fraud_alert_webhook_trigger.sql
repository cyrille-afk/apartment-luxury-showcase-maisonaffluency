CREATE OR REPLACE FUNCTION notify_trade_fraud_alert()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
  should_notify boolean;
BEGIN
  should_notify := NEW.status = 'flagged'
    AND NEW.fraud_flags IS NOT NULL
    AND NEW.fraud_flags @> ARRAY['DUPLICATE_DOCUMENT_FINGERPRINT'];

  IF should_notify THEN
    -- Only fire on INSERT or when status/fraud_flags actually change to avoid spam.
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.fraud_flags IS DISTINCT FROM NEW.fraud_flags THEN
      payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', jsonb_build_object(
          'id', NEW.id,
          'company_name', NEW.company_name,
          'email', NEW.email,
          'document_hash', NEW.document_hash,
          'fraud_flags', NEW.fraud_flags,
          'status', NEW.status
        )
      );

      request_id := net.http_post(
        url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/trade-fraud-alert',
        body := payload,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 5000
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_trade_fraud_alert ON trade_applications;
CREATE TRIGGER trg_notify_trade_fraud_alert
AFTER INSERT OR UPDATE ON trade_applications
FOR EACH ROW
EXECUTE FUNCTION notify_trade_fraud_alert();