#!/usr/bin/env bash
set -euo pipefail
ready=false
for ((attempt=0; attempt<300; attempt++)); do
  if [[ "$(psql -X -qAt -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c 'SELECT public.durable_ready()')" == t ]]; then
    ready=true
    break
  fi
  sleep 0.1
done
if [[ "$ready" != true ]]; then
  echo "pg_durable did not become ready for maintenance initialization." >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT df.grant_usage('api_owner');
BEGIN;
SET LOCAL ROLE api_owner;
SELECT pg_advisory_xact_lock(hashtextextended('kickstopper:maintenance',0));
INSERT INTO public.scheduled_work(name,workflow_instance_id)
SELECT 'maintenance',public.start_maintenance_workflow()
WHERE NOT EXISTS(SELECT 1 FROM public.scheduled_work WHERE name='maintenance');
COMMIT;
SQL
