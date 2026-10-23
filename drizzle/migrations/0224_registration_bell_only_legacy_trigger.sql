CREATE OR REPLACE FUNCTION public.notify_admins_new_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO public.notifications(user_id,title,message,type,link) SELECT DISTINCT user_id,'New User Registration','A new user has registered: '||coalesce(NEW.email,'unknown'),'registration','/trade/admin' FROM public.user_roles WHERE role IN('admin','super_admin') AND user_id<>NEW.id;
RETURN NEW;
END $$;
COMMENT ON FUNCTION public.notify_admins_new_registration() IS 'Bell notifications only; durable registration_alert_events owns external email and WhatsApp dispatch.';