TRUNCATE TABLE
  public.reactions,
  public.dm_reactions,
  public.poll_votes,
  public.polls,
  public.pinned_messages,
  public.deleted_direct_messages,
  public.direct_messages,
  public.messages,
  public.banned_users,
  public.blocked_users,
  public.user_roles,
  public.profiles,
  public.chat_settings
RESTART IDENTITY CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uname text;
BEGIN
  uname := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'ضيف' || floor(random()*100000)::text
  );
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    uname := uname || floor(random()*1000)::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, username, allow_dms) VALUES (NEW.id, uname, true);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

INSERT INTO public.chat_settings (is_locked) VALUES (false);