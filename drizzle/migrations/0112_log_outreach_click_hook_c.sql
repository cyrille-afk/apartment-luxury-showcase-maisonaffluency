create or replace function public.log_outreach_click(_channel text, _hook text, _agent uuid, _lead uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare a uuid; l uuid;
begin
  if _channel not in ('instagram','linkedin','email') then return; end if;
  if _hook is not null and _hook not in ('A','B','C') then _hook := null; end if;
  select _agent into a where _agent is not null and (has_role(_agent,'admin') or has_role(_agent,'super_admin'));
  select id into l from acquisition_leads where id = _lead;
  if exists (select 1 from acquisition_link_clicks where channel=_channel and lead_id is not distinct from l
             and agent_id is not distinct from a and created_at > now() - interval '30 minutes') then return; end if;
  if (select count(*) from acquisition_link_clicks where created_at > now() - interval '1 hour') > 500 then return; end if;
  insert into acquisition_link_clicks(channel, hook, agent_id, lead_id) values (_channel, _hook, a, l);
end $function$;