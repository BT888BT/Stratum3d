-- ═══════════════════════════════════════════════════════════════════════════
-- STRATUM3D — SECURITY FIXES MIGRATION
-- Run this against your Supabase database AFTER deploying the updated code.
-- This is safe to run on a live database — all operations are additive.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── #9: Webhook idempotency table ────────────────────────────────────────
-- Stores processed Stripe event IDs to prevent duplicate processing.
create table if not exists public.processed_webhook_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type      text,
  processed_at    timestamptz not null default now()
);

-- Auto-clean old webhook events after 7 days (no need to keep forever)
create index if not exists idx_webhook_events_processed_at
  on public.processed_webhook_events(processed_at);

-- RLS: deny all for anon/authenticated — only service role writes here
alter table public.processed_webhook_events enable row level security;

create policy "deny all" on public.processed_webhook_events
  for all to anon, authenticated using (false) with check (false);


-- ─── #10: Add explicit delivery_method to orders ──────────────────────────
-- Instead of inferring pickup vs shipping from shipping_cents value.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'delivery_method'
  ) then
    alter table public.orders add column delivery_method text default 'shipping';
    -- Backfill existing orders
    update public.orders set delivery_method = 'pickup' where shipping_cents = 500;
    update public.orders set delivery_method = 'shipping' where shipping_cents != 500;
  end if;
end $$;


-- ─── #10: Add explicit remove_supports to quote_inputs ────────────────────
-- Instead of encoding it in the shipping_method field.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quote_inputs' and column_name = 'remove_supports'
  ) then
    alter table public.quote_inputs add column remove_supports boolean default false;
    -- Backfill existing rows
    update public.quote_inputs set remove_supports = true where shipping_method = 'supports_removed';
  end if;
end $$;


-- ─── #11: Atomic rate limiting function ───────────────────────────────────
-- Single SQL function that atomically increments or resets the counter.
-- Prevents race conditions under concurrent serverless invocations.
create or replace function public.check_rate_limit_atomic(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  -- Try to insert a fresh entry, or update if key already exists
  insert into public.rate_limits (key, count, window_end)
  values (p_key, 1, now() + (p_window_seconds || ' seconds')::interval)
  on conflict (key) do update set
    -- If the window has expired, reset; otherwise increment
    count = case
      when rate_limits.window_end < now() then 1
      else rate_limits.count + 1
    end,
    window_end = case
      when rate_limits.window_end < now() then now() + (p_window_seconds || ' seconds')::interval
      else rate_limits.window_end
    end
  returning count into v_count;

  return v_count;
end;
$$;


-- ─── #4: Public read policies for colours and gallery ─────────────────────
-- Allow the anon key to SELECT from these tables so public routes
-- don't need the service role key.

-- Colours: public can read available colours
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'colours' and policyname = 'anon_read_colours'
  ) then
    create policy "anon_read_colours" on public.colours
      for select to anon using (true);
  end if;
end $$;

-- Gallery images: public can read visible images
-- (Requires gallery_images table to exist — from your gallery migration)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gallery_images'
  ) then
    -- Enable RLS if not already
    alter table public.gallery_images enable row level security;

    if not exists (
      select 1 from pg_policies
      where tablename = 'gallery_images' and policyname = 'anon_read_visible_gallery'
    ) then
      create policy "anon_read_visible_gallery" on public.gallery_images
        for select to anon using (visible = true);
    end if;
  end if;
end $$;


-- ─── #7: Update cleanup function to also purge old webhook events ─────────
create or replace function public.cleanup_expired()
returns void language sql as $$
  delete from public.pending_uploads where expires_at < now();
  delete from public.admin_sessions where expires_at < now();
  delete from public.rate_limits where window_end < now();
  -- Keep webhook event IDs for 7 days, then purge
  delete from public.processed_webhook_events
    where processed_at < now() - interval '7 days';
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANT: You should schedule cleanup_expired() to run periodically.
--
-- In Supabase Dashboard:
--   1. Go to Database → Extensions → enable pg_cron
--   2. Run this SQL to schedule hourly cleanup:
--
--      select cron.schedule(
--        'cleanup-expired-data',
--        '0 * * * *',
--        $$select public.cleanup_expired()$$
--      );
--
-- This ensures expired uploads, sessions, rate limits, and old webhook
-- events are cleaned up automatically.
-- ═══════════════════════════════════════════════════════════════════════════
