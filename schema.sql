-- Café Journal database
-- Run this in Supabase SQL Editor.
-- Café details are public to read. Authenticated, administrator-created editor
-- accounts can add, update, or delete journal entries.

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

alter table public.cafes enable row level security;

drop policy if exists "Users can view their own cafes" on public.cafes;
create policy "Users can view their own cafes"
on public.cafes for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own cafes" on public.cafes;
create policy "Users can create their own cafes"
on public.cafes for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own cafes" on public.cafes;
create policy "Users can update their own cafes"
on public.cafes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own cafes" on public.cafes;
create policy "Users can delete their own cafes"
on public.cafes for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.cafes to authenticated;
grant select on public.cafes to anon;

-- Anyone can read the shared public journal. Authorized editor accounts can
-- maintain any café record (account creation is managed in Supabase).
drop policy if exists "Anyone can view public cafes" on public.cafes;
create policy "Anyone can view public cafes"
on public.cafes for select to anon, authenticated
using (true);

drop policy if exists "Editors can create cafes" on public.cafes;
create policy "Editors can create cafes"
on public.cafes for insert to authenticated
with check (true);

drop policy if exists "Editors can update cafes" on public.cafes;
create policy "Editors can update cafes"
on public.cafes for update to authenticated
using (true) with check (true);

drop policy if exists "Editors can delete cafes" on public.cafes;
create policy "Editors can delete cafes"
on public.cafes for delete to authenticated
using (true);


-- Photo metadata. Actual image bytes live in Supabase Storage.
create table if not exists public.cafe_photos (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

alter table public.cafe_photos enable row level security;

drop policy if exists "Users can view their own cafe photos" on public.cafe_photos;
create policy "Users can view their own cafe photos"
on public.cafe_photos for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own cafe photos" on public.cafe_photos;
create policy "Users can add their own cafe photos"
on public.cafe_photos for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own cafe photos" on public.cafe_photos;
create policy "Users can delete their own cafe photos"
on public.cafe_photos for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, delete on public.cafe_photos to authenticated;
grant select on public.cafe_photos to anon;

drop policy if exists "Anyone can view public cafe photos" on public.cafe_photos;
create policy "Anyone can view public cafe photos"
on public.cafe_photos for select to anon, authenticated
using (true);

drop policy if exists "Editors can add cafe photos" on public.cafe_photos;
create policy "Editors can add cafe photos"
on public.cafe_photos for insert to authenticated
with check (true);

drop policy if exists "Editors can delete cafe photos" on public.cafe_photos;
create policy "Editors can delete cafe photos"
on public.cafe_photos for delete to authenticated
using (true);

-- In Supabase Storage, create a bucket named: cafe-photos
-- Make it PUBLIC so anonymous visitors can see journal photos. Anyone with a
-- photo URL can view that image; uploads/deletes still require an editor login.
-- The policies below allow authenticated editors to upload/delete photos.
drop policy if exists "Users can upload cafe photos" on storage.objects;
create policy "Users can upload cafe photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cafe-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can read their cafe photos" on storage.objects;
create policy "Users can read their cafe photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'cafe-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their cafe photos" on storage.objects;
create policy "Users can delete their cafe photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'cafe-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Editors can upload cafe photos" on storage.objects;
create policy "Editors can upload cafe photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'cafe-photos');

drop policy if exists "Editors can delete cafe photos" on storage.objects;
create policy "Editors can delete cafe photos"
on storage.objects for delete to authenticated
using (bucket_id = 'cafe-photos');
