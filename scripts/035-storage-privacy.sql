-- ============================================================================
-- 035 — Make storage buckets private
--
-- Three buckets are currently PUBLIC, meaning anyone holding (or guessing) an
-- object URL can fetch it with no session at all:
--
--   voice-notes      internal staff voice messages  <-- worst of the three
--   tenant-profiles  tenant profile photographs
--   apartments       unit photography (genuinely public — see below)
--
-- `voice-notes` is the one that matters most: those are internal staff
-- conversations, and the filename is `vn-<epoch>-<6 random chars>.webm`
-- (app/api/internal-chat/voice/route.ts), which is short enough to be worth
-- guessing at scale.
--
-- ⚠️  READ BEFORE RUNNING — THIS IS A STAGED MIGRATION
--
-- Flipping a bucket to private immediately 404s every URL already stored in the
-- database, because those rows hold full public URLs
-- (`.../storage/v1/object/public/<bucket>/<file>`). Run the stages in order and
-- confirm each before moving on.
--
-- Run in the Supabase SQL Editor (same convention as 026 and 029-034).
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 1 — Inspect. Run this alone first; it changes nothing.
-- ════════════════════════════════════════════════════════════════════════════
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY name;

-- How many rows currently store a public URL that would break:
SELECT 'tenants.profile_picture_url' AS column, COUNT(*) AS rows_with_public_url
FROM tenants WHERE profile_picture_url LIKE '%/object/public/%'
UNION ALL
SELECT 'internal_messages.voice_url', COUNT(*)
FROM internal_messages WHERE voice_url LIKE '%/object/public/%';
-- (Adjust the column names above if yours differ — this is a check, not a change.)


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 2 — voice-notes only. Do this one first and on its own.
-- ════════════════════════════════════════════════════════════════════════════
-- Internal staff audio has no legitimate anonymous audience, so there is no
-- "public read" case to preserve. Any existing playback links break, and that
-- is the correct outcome — they were readable by anyone until now.
--
-- The app must serve these through a signed URL after this runs. See the
-- companion helper lib/storage-signed-url.ts.

UPDATE storage.buckets SET public = false WHERE name = 'voice-notes';

-- Only the service role may read or write. RLS on storage.objects is the
-- mechanism; with no policy for anon/authenticated, they are denied outright.
DROP POLICY IF EXISTS "voice_notes_service_only" ON storage.objects;
-- (service_role bypasses RLS, so the absence of a policy IS the lockdown.)


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 3 — tenant-profiles. Run only after Stage 2 is confirmed working.
-- ════════════════════════════════════════════════════════════════════════════
-- Profile photographs are personal data. They are shown to the tenant and to
-- staff, both of whom are authenticated, so a signed URL covers every real use.
--
-- BACKFILL FIRST: rewrite stored public URLs to bare object paths so the app can
-- sign them on demand. Run the UPDATE, verify, then flip the bucket.

-- 3a. Rewrite full public URLs down to just the object name.
UPDATE tenants
SET profile_picture_url = regexp_replace(
      profile_picture_url,
      '^.*/object/public/tenant-profiles/',
      ''
    )
WHERE profile_picture_url LIKE '%/object/public/tenant-profiles/%';

-- 3b. Confirm nothing still holds a full URL.
SELECT COUNT(*) AS remaining_full_urls
FROM tenants
WHERE profile_picture_url LIKE 'http%';

-- 3c. Only when 3b returns 0:
-- UPDATE storage.buckets SET public = false WHERE name = 'tenant-profiles';


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 4 — apartments: DELIBERATELY LEFT PUBLIC
-- ════════════════════════════════════════════════════════════════════════════
-- Unit photography is marketing material shown to anonymous visitors browsing
-- the listings. Making it private would mean signing a URL for every image on
-- a public page — slower, and protecting nothing that is not already meant to
-- be seen. Left public ON PURPOSE, not by omission.
--
-- The write path is already staff-only and validates by magic bytes
-- (app/api/upload-apartment-image/route.ts), so the bucket cannot be used as an
-- open file drop.


-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════════════════
-- UPDATE storage.buckets SET public = true WHERE name IN ('voice-notes', 'tenant-profiles');
-- Note this does NOT restore the rewritten URLs from Stage 3a; take a backup of
-- the tenants table before running that UPDATE.
