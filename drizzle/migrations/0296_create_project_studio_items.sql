create table public.project_studio_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id),
  is_anchor boolean default false,
  locked_finishes jsonb not null,
  calculated_price numeric(10,2) not null,
  calculated_lead_time_weeks int not null,
  custom_position jsonb,
  custom_rotation_y numeric(6,3),
  created_at timestamptz default now()
);

create index project_studio_items_project_id_idx on public.project_studio_items (project_id);
create index project_studio_items_catalog_item_id_idx on public.project_studio_items (catalog_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_studio_items TO authenticated;
GRANT ALL ON public.project_studio_items TO service_role;
REVOKE ALL ON public.project_studio_items FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.project_studio_items FROM authenticated;

alter table public.project_studio_items enable row level security;

create policy "View Project Studio items"
on public.project_studio_items for select
to authenticated
using (public.can_view_project(auth.uid(), project_id));

create policy "Insert Project Studio items"
on public.project_studio_items for insert
to authenticated
with check (public.can_edit_project(auth.uid(), project_id));

create policy "Update Project Studio items"
on public.project_studio_items for update
to authenticated
using (public.can_edit_project(auth.uid(), project_id))
with check (public.can_edit_project(auth.uid(), project_id));

create policy "Delete Project Studio items"
on public.project_studio_items for delete
to authenticated
using (public.can_edit_project(auth.uid(), project_id));