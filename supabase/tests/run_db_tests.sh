#!/usr/bin/env bash
# Uji migration + RLS di Postgres sementara (tanpa project Supabase).
# Butuh salah satu: Docker, atau PostgreSQL 15+ (initdb, pg_ctl, psql) di PATH.
set -euo pipefail
cd "$(dirname "$0")/.."

run_sql() {
  "$@" -v ON_ERROR_STOP=1 -q -f tests/supabase_stub.sql
  for m in migrations/*.sql; do "$@" -v ON_ERROR_STOP=1 -q -f "$m"; done
  "$@" -v ON_ERROR_STOP=1 -q -f tests/rls_test.sql
}

if command -v docker >/dev/null 2>&1; then
  name="wkwk-test-$$"
  docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=test postgres:16 >/dev/null
  trap 'docker stop "$name" >/dev/null' EXIT
  until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
  sleep 1
  for f in tests/supabase_stub.sql migrations/*.sql tests/rls_test.sql; do
    docker exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 -q < "$f"
  done
else
  dir="$(mktemp -d)"
  trap 'pg_ctl -D "$dir/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$dir"' EXIT
  initdb -D "$dir/data" -U postgres -A trust >/dev/null
  pg_ctl -D "$dir/data" -o "-k $dir -p 54329 -c listen_addresses=''" -l "$dir/log" start >/dev/null
  sleep 2
  run_sql psql -h "$dir" -p 54329 -U postgres
fi
