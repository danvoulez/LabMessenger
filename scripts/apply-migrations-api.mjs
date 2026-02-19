#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const MIGRATIONS_DIR = process.argv[2] || 'supabase/migrations'

if (!PROJECT_ID) {
  console.error('SUPABASE_PROJECT_ID is required')
  process.exit(1)
}

if (!ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is required')
  process.exit(1)
}

if (!fs.existsSync(MIGRATIONS_DIR) || !fs.statSync(MIGRATIONS_DIR).isDirectory()) {
  console.log(`No migrations directory found at ${MIGRATIONS_DIR}`)
  process.exit(0)
}

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()

if (migrationFiles.length === 0) {
  console.log(`No migration files found in ${MIGRATIONS_DIR}`)
  process.exit(0)
}

const endpoint = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`

async function runSql(query) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body}`)
  }

  if (!body) return []

  try {
    return JSON.parse(body)
  } catch {
    return []
  }
}

function escapeSqlLiteral(value) {
  return value.replace(/'/g, "''")
}

async function main() {
  console.log('Preparing schema_migrations table via Supabase Management API...')
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  for (const fileName of migrationFiles) {
    const escaped = escapeSqlLiteral(fileName)
    const check = await runSql(
      `SELECT 1 FROM public.schema_migrations WHERE filename = '${escaped}' LIMIT 1;`
    )

    if (Array.isArray(check) && check.length > 0) {
      console.log(`Skipping already applied migration: ${fileName}`)
      continue
    }

    const filePath = path.join(MIGRATIONS_DIR, fileName)
    const sql = fs.readFileSync(filePath, 'utf8')

    console.log(`Applying migration: ${fileName}`)
    await runSql(sql)
    await runSql(
      `INSERT INTO public.schema_migrations (filename) VALUES ('${escaped}') ON CONFLICT (filename) DO NOTHING;`
    )
  }

  console.log('All migrations processed.')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
