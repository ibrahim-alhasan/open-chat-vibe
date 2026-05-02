-- Re-revoke (CREATE OR REPLACE auto-grants EXECUTE to PUBLIC; revoke after definition is the canonical fix)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION public.archive_deleted_direct_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_deleted_direct_message() FROM anon;
REVOKE ALL ON FUNCTION public.archive_deleted_direct_message() FROM authenticated;

-- Ensure service_role and postgres can still execute (triggers run as table owner already)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.archive_deleted_direct_message() TO service_role, postgres;

-- Make storage buckets non-public (blocks listing & enforces per-policy access).
-- Files stay accessible via signed URLs OR through the existing per-name SELECT policies.
UPDATE storage.buckets SET public = false WHERE id IN ('avatars','public_chat_files','direct_message_images');
