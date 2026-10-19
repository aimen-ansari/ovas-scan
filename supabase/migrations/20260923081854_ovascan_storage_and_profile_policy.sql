-- Apply after the two original migrations. Prepared locally; not applied remotely.
-- Keep scan uploads private and apply server-side content limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ultrasound-scans', 'ultrasound-scans', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER POLICY "Users update own profile" ON public.profiles
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

-- The original migrations already enable RLS and constrain predictions and
-- storage objects to their owning user. Preserve those policies and indexes.
