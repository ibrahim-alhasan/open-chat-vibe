
-- 1. Add RLS policies for deleted_direct_messages
CREATE POLICY "Participants and admins read deleted DMs"
ON public.deleted_direct_messages FOR SELECT
TO authenticated
USING (
  sender_user_id = auth.uid()
  OR receiver_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins delete deleted DMs"
ON public.deleted_direct_messages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Restrict dm_reactions reads to DM participants
DROP POLICY IF EXISTS "Authed read dm_reactions" ON public.dm_reactions;

CREATE POLICY "Participants read dm_reactions"
ON public.dm_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.id = dm_reactions.dm_id
      AND (dm.sender_user_id = auth.uid() OR dm.receiver_user_id = auth.uid())
  )
);

-- 3. Revoke EXECUTE from anon/public on the trigger function exposed
REVOKE EXECUTE ON FUNCTION public.enforce_username_from_profile() FROM PUBLIC, anon;
