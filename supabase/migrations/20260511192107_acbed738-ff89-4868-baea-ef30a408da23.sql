-- Deduplicate existing reactions: keep oldest per (message_id, user_id)
DELETE FROM public.reactions r1
USING public.reactions r2
WHERE r1.message_id = r2.message_id
  AND r1.user_id = r2.user_id
  AND r1.created_at > r2.created_at;

-- Edge case: equal created_at, keep lowest id
DELETE FROM public.reactions r1
USING public.reactions r2
WHERE r1.message_id = r2.message_id
  AND r1.user_id = r2.user_id
  AND r1.created_at = r2.created_at
  AND r1.id > r2.id;

ALTER TABLE public.reactions
  ADD CONSTRAINT reactions_one_per_user_per_message UNIQUE (message_id, user_id);