-- Security hardening for LabMessenger:
-- 1) Prevent role/user spoofing in messages.
-- 2) Restrict conversation creation to allowed agent profiles.
-- 3) Add structured task approval primitives (table + RPCs).

-- ---------------------------------------------------------------------------
-- Conversations hardening
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "users_insert_own_conversations" ON public.conversations;
CREATE POLICY "users_insert_own_conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles p
      WHERE p.user_id = agent_user_id
        AND p.user_type IN ('llm', 'computer')
    )
  );

DROP POLICY IF EXISTS "users_and_agents_update_conversations" ON public.conversations;
CREATE POLICY "users_update_own_conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles p
      WHERE p.user_id = agent_user_id
        AND p.user_type IN ('llm', 'computer')
    )
  );

CREATE OR REPLACE FUNCTION public.guard_conversation_routing_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  -- Allow trusted backend maintenance paths.
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'conversation.user_id is immutable';
  END IF;

  IF NEW.agent_user_id <> OLD.agent_user_id THEN
    RAISE EXCEPTION 'conversation.agent_user_id is immutable';
  END IF;

  IF NEW.agent_url IS DISTINCT FROM OLD.agent_url THEN
    RAISE EXCEPTION 'conversation.agent_url is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_conversation_routing_fields_trigger ON public.conversations;
CREATE TRIGGER guard_conversation_routing_fields_trigger
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_conversation_routing_fields();

-- ---------------------------------------------------------------------------
-- Messages hardening (actor-scoped insert/update)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "users_and_agents_insert_messages" ON public.messages;
CREATE POLICY "users_insert_user_messages_only"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND role = 'user'
    AND message_type IN ('message', 'task_approval', 'file')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "agents_insert_assistant_messages_only"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND role IN ('assistant', 'system')
    AND message_type IN ('message', 'task_proposal', 'task_execution', 'handover')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.agent_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "users_and_agents_update_messages" ON public.messages;
CREATE POLICY "users_update_own_user_messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND role = 'user'
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND role = 'user'
    AND message_type IN ('message', 'task_approval', 'file')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "agents_update_own_assistant_messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND role IN ('assistant', 'system')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND c.agent_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND role IN ('assistant', 'system')
    AND message_type IN ('message', 'task_proposal', 'task_execution', 'handover')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.agent_user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Structured task approvals (no free-text protocol dependency)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.task_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  proposal_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  approved_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_commands INTEGER NOT NULL CHECK (max_commands BETWEEN 0 AND 200),
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, approved_by)
);

CREATE INDEX IF NOT EXISTS idx_task_approvals_conversation_id ON public.task_approvals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_task_approvals_task_id ON public.task_approvals(task_id);

ALTER TABLE public.task_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_approvals_select_participants" ON public.task_approvals;
CREATE POLICY "task_approvals_select_participants"
  ON public.task_approvals
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.task_approvals.conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "task_approvals_insert_owner_only" ON public.task_approvals;
CREATE POLICY "task_approvals_insert_owner_only"
  ON public.task_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND approved_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "task_approvals_update_owner_only" ON public.task_approvals;
CREATE POLICY "task_approvals_update_owner_only"
  ON public.task_approvals
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND approved_by = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND approved_by = (SELECT auth.uid())
  );

CREATE OR REPLACE FUNCTION public.approve_task(
  p_conversation_id UUID,
  p_task_id UUID,
  p_max_commands INTEGER DEFAULT 10
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id UUID;
  v_proposal_message_id UUID;
  v_approval_id UUID;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_max_commands < 1 OR p_max_commands > 200 THEN
    RAISE EXCEPTION 'max_commands must be between 1 and 200';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Conversation not owned by current user';
  END IF;

  SELECT m.id
  INTO v_proposal_message_id
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.task_id = p_task_id
    AND m.message_type = 'task_proposal'
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF v_proposal_message_id IS NULL THEN
    RAISE EXCEPTION 'Task proposal not found';
  END IF;

  INSERT INTO public.task_approvals (
    task_id,
    conversation_id,
    proposal_message_id,
    approved_by,
    max_commands,
    status
  )
  VALUES (
    p_task_id,
    p_conversation_id,
    v_proposal_message_id,
    v_user_id,
    p_max_commands,
    'approved'
  )
  ON CONFLICT (task_id, approved_by)
  DO UPDATE SET
    max_commands = EXCLUDED.max_commands,
    status = 'approved',
    created_at = NOW()
  RETURNING id INTO v_approval_id;

  -- Backward compatibility for legacy parser while migrating.
  INSERT INTO public.messages (
    conversation_id,
    user_id,
    role,
    content,
    message_type,
    task_id,
    status
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    'user',
    FORMAT('APPROVED:%s:%s', p_task_id, p_max_commands),
    'task_approval',
    p_task_id,
    'sent'
  );

  RETURN v_approval_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_task(
  p_conversation_id UUID,
  p_task_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id UUID;
  v_proposal_message_id UUID;
  v_rejection_id UUID;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Conversation not owned by current user';
  END IF;

  SELECT m.id
  INTO v_proposal_message_id
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.task_id = p_task_id
    AND m.message_type = 'task_proposal'
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF v_proposal_message_id IS NULL THEN
    RAISE EXCEPTION 'Task proposal not found';
  END IF;

  INSERT INTO public.task_approvals (
    task_id,
    conversation_id,
    proposal_message_id,
    approved_by,
    max_commands,
    status,
    reason
  )
  VALUES (
    p_task_id,
    p_conversation_id,
    v_proposal_message_id,
    v_user_id,
    0,
    'rejected',
    p_reason
  )
  ON CONFLICT (task_id, approved_by)
  DO UPDATE SET
    status = 'rejected',
    reason = EXCLUDED.reason,
    created_at = NOW()
  RETURNING id INTO v_rejection_id;

  -- Backward compatibility for legacy parser while migrating.
  INSERT INTO public.messages (
    conversation_id,
    user_id,
    role,
    content,
    message_type,
    task_id,
    status
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    'user',
    FORMAT('REJECTED:%s', p_task_id),
    'task_approval',
    p_task_id,
    'sent'
  );

  RETURN v_rejection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_task(UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_task(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_task(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_task(UUID, UUID, TEXT) TO authenticated;
