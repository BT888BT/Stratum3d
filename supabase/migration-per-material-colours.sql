-- ═══════════════════════════════════════════════════════════════════════════
-- STRATUM3D — Per-material colour availability
-- Safe to run multiple times (uses IF NOT EXISTS / idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add materials column to colours table
-- NULL = available for all materials
-- e.g. '{"PLA","PETG"}' = only available for PLA and PETG
ALTER TABLE public.colours
ADD COLUMN IF NOT EXISTS materials text[] DEFAULT NULL;

-- All existing colours default to NULL (available for all materials) — no data migration needed.
