-- User profiles + observability services
-- Backend-owned user typing: human | llm | computer

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  nickname TEXT,
  bio TEXT,
  avatar_url TEXT,
  user_type TEXT NOT NULL DEFAULT 'human' CHECK (user_type IN ('human', 'llm', 'computer')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_observability_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'critical')),
  summary TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON public.user_profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_user_observability_services_user_id ON public.user_observability_services(user_id);
CREATE INDEX IF NOT EXISTS idx_user_observability_services_status ON public.user_observability_services(status);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER touch_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_user_observability_services_updated_at ON public.user_observability_services;
CREATE TRIGGER touch_user_observability_services_updated_at
  BEFORE UPDATE ON public.user_observability_services
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Create profile automatically for any new auth user
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  inferred_name TEXT;
  inferred_type TEXT;
BEGIN
  inferred_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'User'
  );

  inferred_type := CASE
    WHEN COALESCE(NEW.email, '') ILIKE 'lab-%@%' THEN 'computer'
    WHEN COALESCE(NEW.email, '') ILIKE '%llm%' THEN 'llm'
    ELSE 'human'
  END;

  INSERT INTO public.user_profiles (user_id, display_name, user_type, metadata)
  VALUES (
    NEW.id,
    inferred_name,
    inferred_type,
    jsonb_build_object('created_by', 'auth_trigger')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user_profile();

-- Backfill existing users
INSERT INTO public.user_profiles (user_id, display_name, user_type, metadata)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'username'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(u.email, ''), '@', 1),
    'User'
  ) AS display_name,
  CASE
    WHEN COALESCE(u.email, '') ILIKE 'lab-%@%' THEN 'computer'
    WHEN COALESCE(u.email, '') ILIKE '%llm%' THEN 'llm'
    ELSE 'human'
  END AS user_type,
  jsonb_build_object('seeded_by', 'migration_20260219')
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_observability_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self_or_conversation_partner" ON public.user_profiles;
CREATE POLICY "profiles_select_self_or_conversation_partner"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      (SELECT auth.uid()) = user_id
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE
          (
            c.user_id = (SELECT auth.uid())
            AND c.agent_user_id = public.user_profiles.user_id
          )
          OR (
            c.agent_user_id = (SELECT auth.uid())
            AND c.user_id = public.user_profiles.user_id
          )
      )
    )
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.user_profiles;
CREATE POLICY "profiles_insert_own"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.user_profiles;
CREATE POLICY "profiles_update_own"
  ON public.user_profiles
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

DROP POLICY IF EXISTS "profiles_delete_own" ON public.user_profiles;
CREATE POLICY "profiles_delete_own"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "observability_select_self_or_conversation_partner" ON public.user_observability_services;
CREATE POLICY "observability_select_self_or_conversation_partner"
  ON public.user_observability_services
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      (SELECT auth.uid()) = user_id
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE
          (
            c.user_id = (SELECT auth.uid())
            AND c.agent_user_id = public.user_observability_services.user_id
          )
          OR (
            c.agent_user_id = (SELECT auth.uid())
            AND c.user_id = public.user_observability_services.user_id
          )
      )
    )
  );

DROP POLICY IF EXISTS "observability_insert_own" ON public.user_observability_services;
CREATE POLICY "observability_insert_own"
  ON public.user_observability_services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "observability_update_own" ON public.user_observability_services;
CREATE POLICY "observability_update_own"
  ON public.user_observability_services
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

DROP POLICY IF EXISTS "observability_delete_own" ON public.user_observability_services;
CREATE POLICY "observability_delete_own"
  ON public.user_observability_services
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

-- Seed default services for computer profiles
WITH computer_users AS (
  SELECT user_id
  FROM public.user_profiles
  WHERE user_type = 'computer'
)
INSERT INTO public.user_observability_services (user_id, service_name, status, summary, details)
SELECT
  cu.user_id,
  seeded.service_name,
  seeded.status,
  seeded.summary,
  seeded.details
FROM computer_users cu
CROSS JOIN (
  VALUES
    ('agent-server', 'healthy', 'Agent process online', '{"port": 3737, "manager": "pm2"}'::jsonb),
    ('supabase-realtime', 'healthy', 'Realtime channel connected', '{"transport": "postgres_changes"}'::jsonb),
    ('command-executor', 'warning', 'No recent command batch yet', '{"last_execution_at": null}'::jsonb)
) AS seeded(service_name, status, summary, details)
ON CONFLICT (user_id, service_name) DO NOTHING;
