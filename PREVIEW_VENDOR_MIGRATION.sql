-- PREVIEW VENDOR MIGRATION
-- Run this in Supabase SQL Editor

-- Add is_preview flag to merchants
-- Preview merchants can use the full vendor dashboard but are HIDDEN from the public marketplace
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false;

-- To mark a specific merchant as preview, run:
-- UPDATE public.merchants SET is_preview = true WHERE name = 'Your Stall Name';
-- or by user email:
-- UPDATE public.merchants m
--   SET is_preview = true
--   FROM public.users u
--   WHERE m.user_id = u.id AND u.email IN ('your@email.com', 'partner@email.com');
