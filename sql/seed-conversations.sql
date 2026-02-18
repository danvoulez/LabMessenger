-- Seed initial conversations for Dan with each lab agent
-- Run in Supabase SQL Editor after schema setup.
--
-- Prerequisites in auth.users:
-- - dan@example.com
-- - lab-256@example.com
-- - lab-512@example.com
-- - lab-8gb@example.com

WITH users_map AS (
  SELECT email, id
  FROM auth.users
  WHERE email IN (
    'dan@example.com',
    'lab-256@example.com',
    'lab-512@example.com',
    'lab-8gb@example.com'
  )
),
dan AS (
  SELECT id AS user_id FROM users_map WHERE email = 'dan@example.com'
),
agent_rows AS (
  SELECT id AS agent_user_id, 'LAB-256 Chat'::text AS title
  FROM users_map WHERE email = 'lab-256@example.com'
  UNION ALL
  SELECT id AS agent_user_id, 'LAB-512 Chat'::text AS title
  FROM users_map WHERE email = 'lab-512@example.com'
  UNION ALL
  SELECT id AS agent_user_id, 'LAB-8GB Chat'::text AS title
  FROM users_map WHERE email = 'lab-8gb@example.com'
),
to_insert AS (
  SELECT
    d.user_id,
    a.agent_user_id,
    a.title
  FROM dan d
  CROSS JOIN agent_rows a
)
INSERT INTO public.conversations (user_id, agent_user_id, title, agent_url, metadata)
SELECT
  t.user_id,
  t.agent_user_id,
  t.title,
  NULL,
  '{}'::jsonb
FROM to_insert t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.conversations c
  WHERE c.user_id = t.user_id
    AND c.agent_user_id = t.agent_user_id
)
RETURNING id, user_id, agent_user_id, title, created_at;

-- Quick check
SELECT c.id, c.user_id, c.agent_user_id, c.title, c.updated_at
FROM public.conversations c
JOIN auth.users u ON u.id = c.user_id
WHERE u.email = 'dan@example.com'
ORDER BY c.created_at DESC;
