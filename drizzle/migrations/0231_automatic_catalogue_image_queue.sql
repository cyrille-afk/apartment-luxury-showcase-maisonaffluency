CREATE TABLE public.product_image_jobs (
 pick_id uuid PRIMARY KEY REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE,
 image_url text NOT NULL, title text, designer_id uuid,
 revision uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','failed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 error text, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_image_jobs TO service_role;
ALTER TABLE public.product_image_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX product_image_jobs_pending ON public.product_image_jobs(next_attempt_at) WHERE status='pending';
CREATE TABLE public.product_image_worker (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), callback_url text,
 paused boolean NOT NULL DEFAULT false, pause_reason text, pause_status integer,
 lease_id uuid, lease_until timestamptz, last_error text
);
GRANT ALL ON public.product_image_worker TO service_role;
ALTER TABLE public.product_image_worker ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.product_image_wakes (
 token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
GRANT ALL ON public.product_image_wakes TO service_role;
ALTER TABLE public.product_image_wakes ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.dispatch_product_image_jobs() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE target text; token text;
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 SELECT callback_url INTO target FROM public.product_image_worker WHERE id=true AND NOT paused;
 IF target IS NULL OR NOT EXISTS(SELECT 1 FROM public.product_image_jobs WHERE status='pending') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='product-image-retry';
  RETURN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='product-image-retry') THEN
  PERFORM cron.schedule('product-image-retry','0 * * * *','select public.dispatch_product_image_jobs()');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.product_image_jobs WHERE status='pending' AND next_attempt_at<=now()) THEN RETURN; END IF;
 token := encode(gen_random_bytes(32),'hex');
 DELETE FROM public.product_image_wakes WHERE expires_at<now();
 INSERT INTO public.product_image_wakes(token_hash) VALUES(encode(digest(token,'sha256'),'hex'));
 BEGIN
  PERFORM net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=120000);
 EXCEPTION WHEN OTHERS THEN
  UPDATE public.product_image_worker SET last_error='Automatic indexing callback could not be dispatched.' WHERE id=true;
 END;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_product_image_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_product_image_jobs() TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_product_image_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.image_url IS NOT DISTINCT FROM OLD.image_url AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.designer_id IS NOT DISTINCT FROM OLD.designer_id AND NEW.is_hidden IS NOT DISTINCT FROM OLD.is_hidden THEN RETURN NEW; END IF;
 IF NEW.is_hidden=false AND coalesce(NEW.image_url,'')<>'' THEN
  INSERT INTO public.product_image_jobs(pick_id,image_url,title,designer_id) VALUES(NEW.id,NEW.image_url,NEW.title,NEW.designer_id)
  ON CONFLICT(pick_id) DO UPDATE SET image_url=excluded.image_url,title=excluded.title,designer_id=excluded.designer_id,revision=gen_random_uuid(),status='pending',attempts=0,next_attempt_at=now(),error=NULL,updated_at=now();
  PERFORM public.dispatch_product_image_jobs();
 ELSE
  DELETE FROM public.product_image_jobs WHERE pick_id=NEW.id;
  DELETE FROM public.product_image_embeddings WHERE pick_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_product_image_job() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER catalogue_image_job AFTER INSERT OR UPDATE OF image_url,title,designer_id,is_hidden ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.enqueue_product_image_job();
CREATE OR REPLACE FUNCTION public.claim_product_image_worker(wake_token text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE lease uuid; valid boolean;
BEGIN
 IF wake_token IS NOT NULL THEN
  DELETE FROM public.product_image_wakes WHERE token_hash=encode(digest(wake_token,'sha256'),'hex') AND expires_at>now() RETURNING true INTO valid;
  IF valid IS DISTINCT FROM true THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='28000'; END IF;
 END IF;
 lease:=gen_random_uuid();
 UPDATE public.product_image_worker SET lease_id=lease,lease_until=now()+interval '10 minutes' WHERE id=true AND NOT paused AND (lease_until IS NULL OR lease_until<now());
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN lease;
END $$;
REVOKE ALL ON FUNCTION public.claim_product_image_worker(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_product_image_worker(text) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_product_image_job(job_pick uuid,job_revision uuid,worker_lease uuid,job_embedding text,job_designer text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE j public.product_image_jobs;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.product_image_worker WHERE id=true AND lease_id=worker_lease AND lease_until>now() AND NOT paused) THEN RETURN false; END IF;
 SELECT * INTO j FROM public.product_image_jobs WHERE pick_id=job_pick AND revision=job_revision AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.designer_curator_picks WHERE id=job_pick AND image_url=j.image_url AND is_hidden=false) THEN RETURN false; END IF;
 INSERT INTO public.product_image_embeddings(pick_id,title,designer_name,image_url,embedding,updated_at) VALUES(j.pick_id,j.title,job_designer,j.image_url,job_embedding::vector(3072),now())
 ON CONFLICT(pick_id) DO UPDATE SET title=excluded.title,designer_name=excluded.designer_name,image_url=excluded.image_url,embedding=excluded.embedding,updated_at=now();
 UPDATE public.product_image_jobs SET status='complete',error=NULL,updated_at=now() WHERE pick_id=job_pick AND revision=job_revision;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.finish_product_image_job(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_product_image_job(uuid,uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.settle_product_image_worker(worker_lease uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 UPDATE public.product_image_worker SET lease_id=NULL,lease_until=NULL WHERE id=true AND lease_id=worker_lease;
 IF NOT EXISTS(SELECT 1 FROM public.product_image_jobs WHERE status='pending') OR EXISTS(SELECT 1 FROM public.product_image_worker WHERE id=true AND paused) THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='product-image-retry';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.settle_product_image_worker(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_product_image_worker(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.match_product_images(query_embedding vector, match_count integer DEFAULT 8)
RETURNS TABLE(pick_id uuid,title text,designer_name text,image_url text,similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT e.pick_id,e.title,e.designer_name,e.image_url,1-(e.embedding::halfvec(3072)<=>query_embedding::halfvec(3072))
 FROM public.product_image_embeddings e JOIN public.designer_curator_picks p ON p.id=e.pick_id
 WHERE p.is_hidden=false AND p.hidden_in_studio=false AND e.embedding IS NOT NULL AND e.image_url=p.image_url
 ORDER BY e.embedding::halfvec(3072)<=>query_embedding::halfvec(3072) LIMIT greatest(1,least(match_count,24))
$$;