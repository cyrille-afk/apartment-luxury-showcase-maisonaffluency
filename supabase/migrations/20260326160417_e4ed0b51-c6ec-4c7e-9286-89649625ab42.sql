
-- 1. Fix presentation_shares: let presentation owners read only their own presentation's shares
CREATE POLICY "Presentation owners can view own shares"
  ON public.presentation_shares
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presentations
      WHERE presentations.id = presentation_shares.presentation_id
        AND presentations.created_by = auth.uid()
    )
  );

-- 2. Fix mutable search_path on email queue functions
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $$ SELECT pgmq.delete(queue_name, message_id); $$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $$ SELECT pgmq.send(queue_name, payload); $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$$;

-- 3. Fix video_watch_events INSERT always-true policy
DROP POLICY IF EXISTS "Anyone can insert video watch events" ON public.video_watch_events;
CREATE POLICY "Anyone can insert video watch events"
  ON public.video_watch_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    video_id IS NOT NULL AND session_id IS NOT NULL AND event_type IS NOT NULL
  );
