-- ============================================================
-- RUN-ALL-PENDING: run this once in the Supabase SQL Editor
-- Combines migrations 022, 024, and 025.
-- Safe to re-run (all use IF NOT EXISTS).
-- ============================================================

-- 022: per-day pricing for apartments
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS price_per_day DECIMAL(10, 2) DEFAULT 0;

-- 024: star rating on client feedback
ALTER TABLE client_feedback
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0;

-- 025: apartment photo gallery + tour video
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Backfill the gallery from the existing single cover image
UPDATE apartments
SET image_urls = jsonb_build_array(image_url)
WHERE (image_urls IS NULL OR image_urls = '[]'::jsonb)
  AND image_url IS NOT NULL
  AND image_url <> '';

-- Verify
SELECT id, name, price_per_day, image_url, image_urls, video_url
FROM apartments
ORDER BY id;
