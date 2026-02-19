-- File transfer support (MVP)
-- Adds message attachments metadata + private storage policies.

-- Extend message types
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (
    message_type IN (
      'message',
      'task_proposal',
      'task_approval',
      'task_execution',
      'handover',
      'file'
    )
  );

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'chat-files',
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON public.message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_conversation_id ON public.message_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_user_id ON public.message_attachments(user_id);

-- Enforce consistency between message_id and conversation_id
CREATE OR REPLACE FUNCTION public.validate_message_attachment_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = NEW.message_id
      AND m.conversation_id = NEW.conversation_id
  ) THEN
    RAISE EXCEPTION 'message_id and conversation_id mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_message_attachment_links_trigger ON public.message_attachments;
CREATE TRIGGER validate_message_attachment_links_trigger
  BEFORE INSERT OR UPDATE ON public.message_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_message_attachment_links();

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select_participants" ON public.message_attachments;
CREATE POLICY "attachments_select_participants"
  ON public.message_attachments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.message_attachments.conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "attachments_insert_owner_in_participant_conversation" ON public.message_attachments;
CREATE POLICY "attachments_insert_owner_in_participant_conversation"
  ON public.message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id
        AND m.user_id = (SELECT auth.uid())
        AND m.conversation_id = conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "attachments_update_owner_only" ON public.message_attachments;
CREATE POLICY "attachments_update_owner_only"
  ON public.message_attachments
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "attachments_delete_owner_only" ON public.message_attachments;
CREATE POLICY "attachments_delete_owner_only"
  ON public.message_attachments
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

-- Private bucket for attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'audio/mpeg',
    'audio/mp4',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- storage.objects policies for paths:
--   {conversation_id}/{uploader_user_id}/{message_id}/{filename}
DROP POLICY IF EXISTS "chat_files_select_participants" ON storage.objects;
CREATE POLICY "chat_files_select_participants"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "chat_files_insert_participants_own_prefix" ON storage.objects;
CREATE POLICY "chat_files_insert_participants_own_prefix"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files'
    AND split_part(name, '/', 2) = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "chat_files_update_owner_prefix" ON storage.objects;
CREATE POLICY "chat_files_update_owner_prefix"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND split_part(name, '/', 2) = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'chat-files'
    AND split_part(name, '/', 2) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "chat_files_delete_owner_prefix" ON storage.objects;
CREATE POLICY "chat_files_delete_owner_prefix"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND split_part(name, '/', 2) = (SELECT auth.uid())::text
  );
