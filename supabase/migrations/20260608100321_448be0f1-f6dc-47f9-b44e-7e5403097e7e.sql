
-- =========================================
-- user_roles: lock down writes, restrict reads to own rows
-- =========================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_roles FROM anon, authenticated;
REVOKE ALL ON public.user_roles FROM anon;

DROP POLICY IF EXISTS "Anyone can read roles" ON public.user_roles;
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Explicit deny policies (defense in depth)
CREATE POLICY "No client inserts to user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client updates to user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes to user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (false);

-- =========================================
-- deleted_direct_messages: block direct inserts (only trigger can write)
-- =========================================
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.deleted_direct_messages FROM anon, authenticated;
REVOKE ALL ON public.deleted_direct_messages FROM anon;

CREATE POLICY "No client inserts to deleted_direct_messages"
  ON public.deleted_direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client updates to deleted_direct_messages"
  ON public.deleted_direct_messages FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

-- =========================================
-- direct_messages: restrict UPDATE to is_read column only
-- =========================================
REVOKE UPDATE ON public.direct_messages FROM anon, authenticated;
REVOKE ALL ON public.direct_messages FROM anon;
GRANT UPDATE (is_read) ON public.direct_messages TO authenticated;
