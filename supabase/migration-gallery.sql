-- ═══════════════════════════════════════════════════════════════════════════
-- STRATUM3D — Gallery migration (run on existing database)
-- Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.gallery_images (
  id          uuid primary key default gen_random_uuid(),
  storage_path text not null,
  caption     text,
  sort_order  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.gallery_images enable row level security;

drop policy if exists "deny all" on public.gallery_images;
create policy "deny all" on public.gallery_images
  for all to anon, authenticated using (false) with check (false);
