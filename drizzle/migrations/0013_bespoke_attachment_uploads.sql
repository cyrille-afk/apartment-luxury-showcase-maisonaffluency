begin;

alter table public.inquiries add column if not exists attachment_path text;

create policy "Allow anon uploads to bespoke attachments"
on storage.objects for insert
to anon
with check (bucket_id = (select id from storage.buckets where name = 'bespoke-attachments'));

create policy "Allow auth uploads to bespoke attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = (select id from storage.buckets where name = 'bespoke-attachments'));

commit;