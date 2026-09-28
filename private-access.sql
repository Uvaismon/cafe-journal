-- Run in Supabase SQL Editor for an existing Café Journal project.
-- All existing policies on these app tables are replaced. Existing rows remain.
alter table public.cafes enable row level security;
alter table public.cafe_photos enable row level security;

do $$
declare p record;
begin
  for p in select policyname,tablename from pg_policies
    where schemaname='public' and tablename in ('cafes','cafe_photos')
  loop execute format('drop policy if exists %I on public.%I',p.policyname,p.tablename); end loop;
end $$;

create policy "Authenticated editors can view cafes" on public.cafes
for select to authenticated using ((select auth.uid()) is not null);
create policy "Editors can create cafes" on public.cafes
for insert to authenticated with check (true);
create policy "Editors can update cafes" on public.cafes
for update to authenticated using (true) with check (true);
create policy "Only approved editors can delete cafes" on public.cafes
for delete to authenticated using ((select auth.uid())='3104249e-192a-48cf-a54a-b2df2687c17c'::uuid);
grant select,insert,update,delete on public.cafes to authenticated;
revoke all on public.cafes from anon;

create policy "Authenticated editors can view cafe photos" on public.cafe_photos
for select to authenticated using ((select auth.uid()) is not null);
create policy "Editors can add cafe photos" on public.cafe_photos
for insert to authenticated with check (true);
create policy "Only approved editors can delete cafe photo records" on public.cafe_photos
for delete to authenticated using ((select auth.uid())='3104249e-192a-48cf-a54a-b2df2687c17c'::uuid);
grant select,insert,delete on public.cafe_photos to authenticated;
revoke all on public.cafe_photos from anon;

-- A public bucket bypasses Storage RLS for downloads. This turns it private.
insert into storage.buckets (id,name,public) values ('cafe-photos','cafe-photos',false)
on conflict (id) do update set public=false;

-- Remove cafe-specific policies and unscoped Storage policies. Storage RLS
-- policies apply to every object unless their predicate narrows access by bucket_id.
-- Public buckets retain their normal public download behavior.
do $$
declare p record;
begin
  for p in select policyname,qual,with_check,roles from pg_policies
    where schemaname='storage' and tablename='objects'
      and (
        coalesce(qual,'') ilike '%cafe-photos%' or coalesce(with_check,'') ilike '%cafe-photos%'
        or (coalesce(qual,'')||coalesce(with_check,'')) not ilike '%bucket_id%'
      )
  loop execute format('drop policy if exists %I on storage.objects',p.policyname); end loop;
end $$;
create policy "Authenticated editors can read cafe photos" on storage.objects
for select to authenticated using (bucket_id='cafe-photos' and (select auth.uid()) is not null);
create policy "Editors can upload cafe photos" on storage.objects
for insert to authenticated with check (bucket_id='cafe-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Only approved editors can delete cafe photo files" on storage.objects
for delete to authenticated using (bucket_id='cafe-photos' and (select auth.uid())='3104249e-192a-48cf-a54a-b2df2687c17c'::uuid);
