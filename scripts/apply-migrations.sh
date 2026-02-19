#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"

MIGRATIONS_DIR="${1:-supabase/migrations}"
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "No migrations directory found at $MIGRATIONS_DIR"
  exit 0
fi

shopt -s nullglob
migration_files=("$MIGRATIONS_DIR"/*.sql)
if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

echo "Preparing schema_migrations table..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

IFS=$'\n' migration_files=($(printf '%s\n' "${migration_files[@]}" | sort))
unset IFS

for file in "${migration_files[@]}"; do
  filename="$(basename "$file")"

  already_applied="$({
    psql "$SUPABASE_DB_URL" \
      -v ON_ERROR_STOP=1 \
      -v filename="$filename" \
      -Atqc "SELECT 1 FROM public.schema_migrations WHERE filename = :'filename' LIMIT 1;"
  } || true)"

  if [[ "$already_applied" == "1" ]]; then
    echo "Skipping already applied migration: $filename"
    continue
  fi

  echo "Applying migration: $filename"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$SUPABASE_DB_URL" \
    -v ON_ERROR_STOP=1 \
    -v filename="$filename" \
    -c "INSERT INTO public.schema_migrations (filename) VALUES (:'filename');"

done

echo "All migrations processed."
