-- Café Journal: private shared journal for authenticated editor accounts.
-- Run in the Supabase SQL Editor. New rows/photos can be created and updated by
-- any signed-in editor. Only the allowlisted account can delete.

create extension if not exists pgcrypto;

create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  area text,
  visited_at date,
  had text,
  coffee integer check (coffee between 1 and 5),
  food integer check (food between 1 and 5),
  ambience integer check (ambience between 1 and 5),
  wifi integer check (wifi between 1 and 5),
  overall_rating numeric(2,1) generated always as (
    case
      when coffee is null and food is null and ambience is null and wifi is null then null
      else round(((coalesce(coffee,0)+coalesce(food,0)+coalesce(ambience,0)+coalesce(wifi,0))::numeric /
        nullif((case when coffee is not null then 1 else 0 end +
                case when food is not null then 1 else 0 end +
                case when ambience is not null then 1 else 0 end +
                case when wifi is not null then 1 else 0 end),0)),1)
    end
  ) stored,
  spend numeric(10,2) check (spend is null or spend >= 0),
  favourite boolean not null default false,
  revisit text not null default 'Maybe' check (revisit in ('Yes','Maybe','No')),
  vibe text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cafe_photos (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

alter table public.cafes enable row level security;
alter table public.cafe_photos enable row level security;

-- Clear prior app policies; multiple permissive policies combine with OR.
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

-- Create or convert the bucket to private. Image downloads use an authenticated
-- Storage API call in the app (not public or signed URLs).
insert into storage.buckets (id,name,public) values ('cafe-photos','cafe-photos',false)
on conflict (id) do update set public=false;

-- Remove bucket-specific old policies and unscoped policies. Storage policies
-- apply to every object unless their predicate narrows access by bucket_id.
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
