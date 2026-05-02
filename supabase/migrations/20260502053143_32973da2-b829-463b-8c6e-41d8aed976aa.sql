DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_length_check') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_content_length_check
      CHECK (char_length(content) <= 5000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_username_length_check') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_username_length_check
      CHECK (char_length(username) >= 1 AND char_length(username) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format_check
      CHECK (char_length(username) >= 1 AND char_length(username) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_content_length_check') THEN
    ALTER TABLE public.direct_messages
      ADD CONSTRAINT direct_messages_content_length_check
      CHECK (char_length(content) <= 5000);
  END IF;
END$$;
