-- Apartment gallery (multiple photos) + tour video
-- image_urls: JSON array of photo URLs (gallery). image_url stays as the primary/cover photo.
-- video_url: a single short tour video URL.

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Backfill: put any existing single image into the gallery so old apartments still show a photo
UPDATE apartments
SET image_urls = jsonb_build_array(image_url)
WHERE (image_urls IS NULL OR image_urls = '[]'::jsonb)
  AND image_url IS NOT NULL
  AND image_url <> '';

-- Verify
SELECT id, name, image_url, image_urls, video_url
FROM apartments
ORDER BY id;
