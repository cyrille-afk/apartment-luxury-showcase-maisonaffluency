ALTER TABLE public.trade_quotes ADD COLUMN procurement_issued_at timestamptz;
ALTER TABLE public.client_boards ADD COLUMN procurement_issued_at timestamptz;
COMMENT ON COLUMN public.trade_quotes.procurement_issued_at IS 'Immutable issuance marker shared by folder and quote archive; payment status remains independent.';
CREATE OR REPLACE FUNCTION public.guard_procurement_quote_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND OLD.procurement_issued_at IS NOT NULL THEN
  IF (to_jsonb(NEW) - ARRAY['status','updated_at','admin_notes','responded_at','confirmed_at','credit_applied_cents','client_pdf_path','client_pdf_updated_at','client_pdf_download_token']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at','admin_notes','responded_at','confirmed_at','credit_applied_cents','client_pdf_path','client_pdf_updated_at','client_pdf_download_token']) THEN
   RAISE EXCEPTION 'Issued procurement document is read-only';
  END IF;
  IF NEW.status = 'draft' THEN RAISE EXCEPTION 'Issued procurement document cannot return to draft'; END IF;
 ELSIF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'submitted' THEN
  NEW.procurement_issued_at := now();
 ELSIF NEW.procurement_issued_at IS NOT NULL THEN
  RAISE EXCEPTION 'Procurement issuance requires finalizing a draft';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_guard_procurement_quote_archive BEFORE INSERT OR UPDATE ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_quote_archive();
CREATE OR REPLACE FUNCTION public.sync_procurement_issue_folder() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.procurement_issued_at IS NOT NULL THEN
  UPDATE public.client_boards b SET status = 'in_procurement_review', procurement_issued_at = COALESCE(b.procurement_issued_at, NEW.procurement_issued_at)
   WHERE (b.id = NEW.project_board_id OR EXISTS (SELECT 1 FROM public.client_board_items i WHERE i.board_id = b.id AND i.procurement_quote_id = NEW.id)) AND b.project_id IS NOT DISTINCT FROM NEW.project_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_procurement_issue_folder AFTER UPDATE OF status ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.sync_procurement_issue_folder();
CREATE OR REPLACE FUNCTION public.guard_procurement_archive_line() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE qid uuid;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  PERFORM 1 FROM public.trade_quotes WHERE id = OLD.quote_id AND procurement_issued_at IS NOT NULL FOR UPDATE;
  IF FOUND AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Issued procurement line items are read-only'; END IF;
 END IF;
 IF TG_OP <> 'DELETE' THEN
  SELECT id INTO qid FROM public.trade_quotes WHERE id = NEW.quote_id AND procurement_issued_at IS NOT NULL FOR UPDATE;
  IF qid IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Issued procurement line items are read-only'; END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER aaa_guard_procurement_archive_line BEFORE INSERT OR UPDATE OR DELETE ON public.trade_quote_items FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_archive_line();
REVOKE ALL ON FUNCTION public.guard_procurement_quote_archive(), public.sync_procurement_issue_folder(), public.guard_procurement_archive_line() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_procurement_quote_archive(), public.sync_procurement_issue_folder(), public.guard_procurement_archive_line() TO service_role;