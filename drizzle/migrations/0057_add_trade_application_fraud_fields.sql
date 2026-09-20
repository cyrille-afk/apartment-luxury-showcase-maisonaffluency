ALTER TABLE trade_applications
  ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS fraud_flags TEXT[];

CREATE OR REPLACE FUNCTION check_document_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM trade_applications
    WHERE document_hash = NEW.document_hash
      AND id != NEW.id
  ) THEN
    NEW.status := 'flagged';
    NEW.fraud_flags := array_append(NEW.fraud_flags, 'DUPLICATE_DOCUMENT_FINGERPRINT');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_document_fingerprint
BEFORE INSERT ON trade_applications
FOR EACH ROW
EXECUTE FUNCTION check_document_fingerprint();