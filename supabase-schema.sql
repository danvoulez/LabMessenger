-- LAB 512 Remote Control - Supabase Schema (Improved)
-- Execute no SQL Editor do Supabase
-- ✅ RLS policies com TO authenticated
-- ✅ Triggers com SECURITY DEFINER e search_path restrito
-- ✅ NOT NULL constraints onde apropriado
-- ✅ Índices adicionais para performance

-- Necessário para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Conversas/Chats
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova Conversa',
  agent_url TEXT, -- URL do agent (backup/fallback)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Mensagens
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  commands_executed JSONB,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'error')),
  -- Task approval system
  message_type TEXT DEFAULT 'message' CHECK (message_type IN ('message', 'task_proposal', 'task_approval', 'task_execution', 'handover', 'file')),
  task_id UUID, -- ID da tarefa (para linking proposal → approval → execution)
  task_data JSONB -- {title, steps, estimated_commands, max_commands, commands_used}
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_user_id ON public.conversations(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at ON public.conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- RLS (Row Level Security)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies: Conversas (usuários E agents veem suas conversas)
DROP POLICY IF EXISTS "users_and_agents_select_conversations" ON public.conversations;
CREATE POLICY "users_and_agents_select_conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND 
    ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = agent_user_id)
  );

DROP POLICY IF EXISTS "users_insert_own_conversations" ON public.conversations;
CREATE POLICY "users_insert_own_conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "users_and_agents_update_conversations" ON public.conversations;
CREATE POLICY "users_and_agents_update_conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND 
    ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = agent_user_id)
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = agent_user_id)
  );

DROP POLICY IF EXISTS "users_delete_own_conversations" ON public.conversations;
CREATE POLICY "users_delete_own_conversations"
  ON public.conversations
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- Policies: Mensagens (visíveis para user E agent da conversa)
DROP POLICY IF EXISTS "users_and_agents_select_messages" ON public.messages;
CREATE POLICY "users_and_agents_select_messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "users_and_agents_insert_messages" ON public.messages;
CREATE POLICY "users_and_agents_insert_messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "users_and_agents_update_messages" ON public.messages;
CREATE POLICY "users_and_agents_update_messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = (SELECT auth.uid()) OR c.agent_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "users_delete_own_messages" ON public.messages;
CREATE POLICY "users_delete_own_messages"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

-- Trigger: Atualiza timestamps da conversa quando nova mensagem inserida
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.conversations
  SET
    updated_at = NOW(),
    last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_conversation_on_message ON public.messages;
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();

-- Trigger: Auto-gera título da conversa na primeira mensagem do usuário
CREATE OR REPLACE FUNCTION public.generate_conversation_title()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'user' THEN
    -- Só atualiza se título ainda for o placeholder padrão
    UPDATE public.conversations
    SET title = LEFT(NEW.content, 200)
    WHERE id = NEW.conversation_id
      AND title = 'Nova Conversa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_title_on_first_message ON public.messages;
CREATE TRIGGER generate_title_on_first_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_conversation_title();

-- Realtime: Habilita subscriptions (gerenciado automaticamente pelo Supabase)
-- Descomente se precisar adicionar manualmente:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
