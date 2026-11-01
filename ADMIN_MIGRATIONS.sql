-- ============================================================
-- ADMIN UPGRADE MIGRATIONS
-- Run these in Supabase SQL Editor (in order)
-- ============================================================

-- 1. Add approval status to menu_items
--    pending = awaiting admin review (default for new items)
--    approved = visible to customers
--    rejected = hidden, merchant sees it grayed out
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS approval_status character varying NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 2. Add display_order to merchants for admin drag-to-reorder
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Seed display_order from current alphabetical order so existing merchants
-- don't all start at 0 and look randomised.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) - 1 AS rn
  FROM public.merchants
)
UPDATE public.merchants m
SET display_order = ranked.rn
FROM ranked
WHERE m.id = ranked.id;

-- 3. Add poster / banner image url to events (already in schema but ensure column exists)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS banner_image_url text;

-- 4. Add event_url so each event can link to its own dedicated page
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_url text;

-- ============================================================
-- DONE. Refresh your Supabase table editor to verify columns.
-- ============================================================
