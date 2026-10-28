# 05 · Generated API

The same Kickstopper product as 04, without Express or a handwritten HTTP application server. **PostgREST 16.5** generates the API from a small exposed database schema. Product rules, permissions, and ownership checks live in Postgres.

**There are still three containers:** frontend host, PostgREST, Postgres. We deleted application server code, not the HTTP process. That process stays visible on the diagram.

## Run it

Requirements: Docker Desktop/Compose, roughly 8 GB assigned to Docker, and ports **3000**, **3001**, and **54320** available. Prepare online before presenting.

```sh
# From this checkpoint:
./scripts/demo prepare --local
./scripts/demo start
```

`--local` skips explicit service-image pulls, not missing build dependencies. The API image copies the native static binary from digest-pinned `postgrest/postgrest:v16.5` into pinned Alpine 3.22.2 for non-root execution and actual HTTP health probes. The database retains the complete independently buildable Postgres 17.8/pgvector/pg_durable/pg_duckdb recipe from 04. It does not depend on neighboring directories or their local images.

Both ARM64 and AMD64 PostgREST manifests exist. This implementation was exercised natively on the ARM64 laptop, not through emulation.

From the repository root:

```sh
./scripts/demo prepare 05 --local
./scripts/demo stop 04
./scripts/demo start 05
```

Open **http://localhost:3000** and refresh the browser after the prepared switch. The generated API is available directly at **http://localhost:3001** and through the frontend's `/api/` proxy.

Switching checkpoints is a **prepared transition, not a live data migration**. Earlier data volumes are neither reused nor reset. Public ports stay the same; stop the old checkpoint first.

```sh
./scripts/demo status
./scripts/demo logs
./scripts/demo stop
./scripts/demo start

# Explicitly destructive, limited to kickstopper-05-generated-api_postgres-data:
./scripts/demo reset --confirm-delete-demo-data
```

Ordinary stop/start preserves project, funding, and workflow data. `start` uses `--no-build --pull never`, so the core demo needs no network after preparation. Build/preload images before the event; first-time native pg_durable preparation is still substantial. A same-architecture `docker image save` / `docker image load` transfer is an alternative to rebuilding the prepared database image.

## What actually disappeared

- The entire `backend/` runtime: Express, Node HTTP routes, database client/pool code, runtime package/lockfile, startup/health scripts, and Dockerfile.
- Express and its transitive application-server dependencies.
- API-process startup registration of maintenance. A one-time database initializer now starts the same durable SQL maintenance graph as a non-superuser service role.

The `tests/` package is a **development-only** Node/`pg` test driver. It is not built into or started by Compose. The runtime API process is `/bin/postgrest`, not Node.

The existing screens and chart are retained. A small framework-free [browser adapter](./frontend/src/api-client.js) translates their existing calls to generated resources/RPCs. It contains no money, ownership, approval, or query execution rules. Both Nginx and Vite strip only the `/api` proxy prefix; neither implements business routes.

## Generated API surface

Only the `api` schema is exposed:

| Resource | Purpose |
|---|---|
| `GET /projects` | Generated read-only project view; excludes embeddings, search documents, and owner IDs |
| `GET /semantic_queries` | Prepared query labels, not embedding vectors |
| `GET /funding`, `GET /events` | Generated owner-scoped views with database RLS |
| `POST /rpc/project_summaries` | Cached summaries plus ranked keyword/category filtering |
| `POST /rpc/similar` | Same prepared vectors and pgvector cosine ordering |
| `POST /rpc/back_project` | Validated, transactional, idempotent fake backing |
| `POST /rpc/request_funding` | Owner-checked durable submission |
| `POST /rpc/decide_funding` | Owner-checked, idempotent durable approval handoff |
| `POST /rpc/expire_demo` | Clearly scoped local rehearsal deadline control |
| `GET /rpc/analytics` | Same dashboard payload with actual DuckDB aggregation |
| `GET /rpc/health` | Successful recent durable maintenance, not just an open socket |
| `GET /` | Permission-filtered generated OpenAPI description |

Summary/similarity RPCs use POST because an empty/expired UNLOGGED cache may be regenerated. They are honestly marked volatile, not falsely declared read-only to make GET work.

Example generated resource URLs:

```text
http://localhost:3001/projects?id=eq.1
http://localhost:3000/api/projects?select=id,name,pledged_cents
http://localhost:3000/api/
```

Direct project/funding/event writes are not granted. The write RPCs are narrowly scoped commands because backing totals, idempotency, ownership, and durable intent must commit together. There is no catch-all SQL executor or database HTTP router hidden in a function.

PostgREST's native errors and resource/filter conventions differ from Express. The browser adapter preserves the screen-level data contract and surfaces `message`/HTTP errors, including mapping a missing singular resource to a visible not-found error. Old Express paths are **not** secretly retained on the server.

## Identity, roles, and ownership

**This is a local demo, not a public authentication system.** The browser automatically uses a public, non-expiring example JWT for the shared demo founder. Its signing key is a disposable public Compose example. No login provider/UI is added, and there are no database credentials or signing key in the browser bundle. Do not expose this stack publicly or put real data/money into it.

| Role | Boundary |
|---|---|
| `api_authenticator` | PostgREST's non-superuser, `NOINHERIT` login; can impersonate only `web_anon` and `web_user` |
| `web_anon` | Public project/preset reads, cached/vector read RPCs, and health; no writes or funding records |
| `web_user` | Verified JWT subject; owner-scoped funding/events and allowed commands |
| `api_owner` | Non-superuser service/object owner; runs invariant-preserving functions and durable activities; cannot be impersonated by the HTTP login |
| `analytics_executor` | Read-only loopback login with SELECT on only aggregate inputs; DuckDB routing enabled; cannot be impersonated by the HTTP login |

Seeded projects belong to the shared fake founder UUID `11111111-1111-4111-8111-111111111111`. This preserves the original product tour where the presenter plays founder and reviewer. It is not a real-world self-approval policy.

RLS protects `funding_requests` and `workflow_events`; their exposed views are `security_invoker` views. Backings are not exposed as a raw resource: the command checks identity and idempotency ownership before returning a receipt. Aggregate inputs intentionally remain available to the isolated analytics role, not as private HTTP resources.

Privileged write routines are owned by `api_owner`, have fixed trusted search paths, and are explicitly granted to the proper API role. Internal schemas and original workflow-control functions are not exposed. App helpers have their default public execution revoked. Workflows are submitted by **`api_owner`, not a superuser**; superuser durable-instance creation is disabled. The extension's administrative dispatcher still uses its required server-side worker role.

Tests use a second signed fake subject to prove that private funding rows/events and decisions cannot cross owners. Tests also reject invalid/expired JWTs, forged privileged roles, raw writes, private-schema selection, and another actor's idempotency key.

## The analytics compatibility boundary

PostgREST's generated JSON wrapper contains PostgreSQL functions that DuckDB does not implement. Simply setting `duckdb.force_execution=true` produced correct-looking results through a **native Postgres fallback**. That is not accepted as preserving the 04 demonstration.

The narrow analytics RPC therefore uses built-in **dblink** for fixed read-only queries back to the **same database instance**:

1. A fixed definer routine opens a Unix-socket connection as `analytics_executor`.
2. That role has DuckDB execution enabled and default read-only transactions; the routine explicitly begins one repeatable-read/read-only transaction.
3. Only the same three aggregate queries execute on that backend, outside PostgreSQL function execution.
4. The outer backend serializes their results into the original JSON payload, commits, and closes the loopback connection. Errors close it and are rethrown, not replaced with success-shaped data.

This adds a database connection boundary, **not an external server, warehouse, HTTP shim, or unsafe-mode exception**. The analytics routine is the one deliberately privileged definer needed to open a local passwordless loopback connection; it takes no SQL, connection strings, roles, or arbitrary query arguments from the client. The target role can read only aggregate inputs.

`duckdb.unsafe_allow_execution_inside_functions`, cloud/external access, automatic extension downloads, and pg_durable HTTP remain disabled. The PostgreSQL JSON wrapper is not claimed to be a DuckDB plan. Tests extract the actual inner queries from the RPC and verify their `DuckDBScan` plans under the actual analytics role and its login settings.

Ordinary data remains in Postgres tables. This is not a columnar-storage migration or a production-warehouse benchmark. Each dashboard request has an extra loopback connection; connection budgets and analytical CPU/memory now belong to Postgres. A large or heavily concurrent workload can justify separation again.

## Rehearsal

1. Browse, search `sourdough`, and use the meetings/bread similarity presets. The product is unchanged.
2. Open the generated OpenAPI root and project resource. Show that only a small exposed schema is published.
3. Back Honk with $25. Request funding, wait for risk 32/100, and approve its fake $2,500 grant.
4. Open Analytics: the same chart still uses DuckDB, not a hidden Postgres fallback.
5. In VS Code, inspect `api.projects`, `api.funding`, RLS policies, and the scoped command definitions.
6. Show that `backend/` and its runtime package/lockfile are gone. Compose still has **frontend, PostgREST, Postgres**.
7. Highlight the PostgREST node: “We deleted our application server code. We still have an HTTP process. Please remember that.”

The actual same-volume durable restart demonstration remains supported: wait for approval, capture the real eight-character instance ID separately from the request UUID, run `docker compose restart postgres`, reconnect, and approve the same instance. Do not reset or switch checkpoints for that proof.

For the DuckDB plan, connect in VS Code and run the complete transaction:

```sql
BEGIN READ ONLY;
SET LOCAL ROLE analytics_executor;
SET LOCAL duckdb.force_execution=true;
EXPLAIN (ANALYZE, BUFFERS)
SELECT category, sum(pledged_cents)::double precision
FROM public.projects GROUP BY category ORDER BY 2 DESC;
COMMIT;
```

Use the Microsoft PostgreSQL extension at `localhost:54320`, database/user `kickstopper`, password `kickstopper-local`, SSL disabled. The URI form should omit the password and use its separate field:

```text
postgresql://kickstopper@localhost:54320/kickstopper?sslmode=disable
```

Refresh the schema after switching checkpoints. Administrative SQL access is distinct from the generated HTTP role; it is not evidence that an anonymous API client can bypass RLS.

## Validation and remaining work

```sh
cd tests
npm ci
npm test
```

Tests require a fresh running 05 and mutate only its demo data. They exercise the framework-free browser client **and** direct PostgREST resources/RPCs, including actual HTTP statuses, concurrent retries, SQL rule boundaries, all prepared vector rankings, identity/role/RLS restrictions, real DuckDB plans, maintenance, and the same-instance restart. Reset explicitly afterward for rehearsal.

The optional old search-plan SQL files remain for independent reproducibility. The chapter's analytics plan should be executed under `analytics_executor` as above, not by turning on unsafe function execution or claiming PostgREST's outer JSON plan is DuckDB.

Checkpoint 06, the full React/plv8/HTTP extension-combination gate, the slide site/Pages workflow, pghacker interlude, and fallback recordings remain outstanding. No recording or one-rectangle finale is claimed to exist.
