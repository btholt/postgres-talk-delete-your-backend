# 04 · Analytics inside Postgres

The same **Kickstopper** app as checkpoint 03, with ClickHouse and its refresh plumbing subtracted. The existing dashboard now runs through **pg_duckdb** over current Postgres data. The chart, metrics, categories, seed data, search/cache/vectors, funding rules, and frontend dependencies are retained.

## Run it

Requirements: Docker Desktop with Compose v2 or later, ports **3000**, **3001**, and **54320** available, and approximately 8 GB assigned to Docker. Application builds use Node **24.15.0**. No payment provider, inference API, account, CDN, or downloaded font is used at runtime.

The [database Dockerfile](./database/Dockerfile) retains 03's independently buildable, pinned **Postgres 17.8 + pgvector 0.8.1 + pg_durable 0.2.9** recipe. It adds native pg_duckdb binaries from `pgduckdb/pgduckdb:17-v1.1.1`, pinned to multi-architecture digest `sha256:302d06d005b6b26512ed68f3d752842641c3c36504d18e8a76e60e3354e00d22`, and installs their runtime curl dependency.

The donor binaries were built for Postgres 17.7 on Debian; this combination was exercised on the retained Postgres 17.8 runtime, natively on ARM64, including all three production analytics plans and the durable restart test. There is no emulation or dependency on checkpoint 03's local image. Both ARM64 and AMD64 donor manifests exist; this laptop validation is ARM64.

**Version detail:** release **v1.1.1** intentionally retains PostgreSQL extension schema version **1.1.0**. `pg_extension.extversion` should therefore say `1.1.0`, not `1.1.1`. [06-analytics.sql](./database/06-analytics.sql) pins that actual schema version.

A fresh build still includes pg_durable's native Rust preparation. If 03 was built on this laptop, its compiler layers are reused; the added DuckDB binaries are prebuilt. Downloads use HTTPS and pinned digests/checksums. `prepare --local` skips service-image pulls, **not** missing build dependencies or the donor image. Build before the event. After preparation, normal startup makes no registry or package-manager requests.

From this directory:

```sh
# Optional: the committed defaults already work for disposable local data.
cp .env.example .env

# Do this online before the event. Pull services and build both application images.
./scripts/demo prepare

# If service images are already local, avoid registry pulls (useful on airplane Wi-Fi):
./scripts/demo prepare --local

# Intentionally refuses image pulls or builds. Works offline after preparation.
./scripts/demo start
```

Open **http://localhost:3000**. Startup waits for the pg_durable engine and its first successful SQL maintenance tick. There is no warehouse snapshot or HTTP refresh. The Compose project is always `kickstopper-04-analytics`; no global Docker context or other project's containers are modified.

All three services use `restart: unless-stopped`. Explicitly stopped containers remain stopped until `./scripts/demo start`. `start` never pulls or builds. A prebuilt-image alternative is to transfer `kickstopper-04-postgres:local` with `docker image save` / `docker image load` between machines of the same architecture, then build the application images locally.

```sh
./scripts/demo status
./scripts/demo logs
./scripts/demo stop                  # Preserves the database volume.
./scripts/demo start                 # Same data, not a reset.

# Explicitly destructive, limited to this checkpoint's one named demo volume.
./scripts/demo reset --confirm-delete-demo-data
```

`reset` without the confirmation flag refuses to run. Reset recreates the deterministic project data and clears pledges, funding requests, and the expiration rehearsal. Initial deadlines and backing timestamps are relative to the reset date; names, IDs, amounts, vectors, and the distribution of historical data are deterministic.

From the repository root:

```sh
./scripts/demo prepare 04 --local
./scripts/demo stop 03
./scripts/demo start 04
```

Stop the previous checkpoint first because public ports are unchanged. This is a **prepared transition, not a live data migration**. All earlier checkpoints have separate volumes and images; none are reused or reset. This directory is independently buildable and runnable without neighboring checkpoints.

## The actual service inventory

| Logical box | Compose container(s) | Working responsibility |
|---|---|---|
| Frontend host | `frontend` | Nginx 1.28.0 serves the locally built React 19.1.1 app and proxies `/api` |
| Express API | `api` | Same handwritten HTTP routes; analytics runs on a transaction-scoped database connection |
| Database + search/cache/vectors/workflows/timers/analytics | `postgres` | Postgres 17.8, pgvector 0.8.1, pg_durable 0.2.9, pg_duckdb v1.1.1 binaries |

**Two surrounding responsibilities plus Postgres: three containers, down from four in 03.** ClickHouse, its volume/configuration/credentials, snapshot-copy helper, refresh endpoint, and durable HTTP refresh step are gone. The diagram grows Postgres with `Analytics.`. Express remains a real HTTP process; it has not disappeared. Request highlights are scripted explanations, not telemetry.

Only Nginx, the API, and Postgres bind host ports, all on loopback. There is no hidden warehouse, snapshot refresh process, Node polling worker, or scheduler. pg_durable still owns expiration and cache cleanup, now as a SQL-only maintenance loop.

**No cloud analytics dependency:** pg_durable HTTP is now explicitly **disabled**. DuckDB external access, automatic extension installation/loading, and unsafe execution inside PostgreSQL functions are disabled. The actual analytics queries were exercised in an isolated container with networking disabled. No MotherDuck account, token, remote file, or runtime extension download is needed. This is still a loopback-only demo with a shared superuser identity, not production authorization.

## Demonstration: same features, fewer services

Keep this chapter short: the same dashboard, a real DuckDB plan, then the removed service.

1. On fresh data, open **Analytics**: **$123,820**, **874** backers, eight live projects, fourteen daily bars, and four category totals. These are the same values/shapes as ClickHouse.
2. Show the new source label: **Postgres + pg_duckdb**. The chart component itself is unchanged.
3. Open [05-analytics.sql](./scripts/sql/05-analytics.sql) in the Microsoft PostgreSQL extension and execute the **whole transaction**. Inspect the real `Custom Scan (DuckDBScan)` plan for the same UTC daily-pledge query.
4. Back Honk with **$25**, then refresh Analytics: **$123,845** and **875** backers appear without waiting for replication. The browser still polls every five seconds.
5. Open **Under the hood**: ClickHouse is gone, only frontend/Express remain outside Postgres, and `Analytics.` is inside the larger Postgres node. **SHIP IT. For this workload.**

Browse, keyword search, semantic presets, backing, stable project IDs, prepared vectors, funding graphs/rules, chart, metrics, and layout are unchanged. Backend/frontend package manifests and lockfiles are byte-for-byte identical to 03.

**Intentional freshness change:** `/api/analytics` keeps the same data fields and numeric/string JSON types, but reads current base tables in one read-only repeatable-read transaction. `source` changes to `Postgres + pg_duckdb`; `refreshed_at` is now query time; `refresh_interval_seconds: 5` describes the retained browser polling cadence, not warehouse replication. This change is explicit in the UI copy.

Optional scheduling demo: **Make WalkBlock due** still leaves expiration to the same durable maintenance loop, which also cleans expired summary-cache entries. Once expiration commits, the next analytics request reads it directly. There is no HTTP activity or cron container.

## Working in VS Code

In the connection-string form, omit the password from the URI and enter it in the separate password field:

```text
postgresql://kickstopper@localhost:54320/kickstopper?sslmode=disable
```

Password: `kickstopper-local`. A `connection refused` error means the server is not reachable, not that the password was rejected. Run `./scripts/demo start` and wait for all services to become healthy before retrying.

Use the Microsoft PostgreSQL extension with:

```text
Host: localhost
Port: 54320
Database: kickstopper
User: kickstopper
Password: kickstopper-local
SSL: disabled (local disposable demo only)
```

Reconnect after switching checkpoints: ports and credentials are unchanged, but the persistent database volume is different. Refresh schema exploration to see `pg_duckdb` alongside `vector` and `pg_durable`. The schema version of `pg_duckdb` is `1.1.0` for these v1.1.1 binaries.

The short analytics reveal is [05-analytics.sql](./scripts/sql/05-analytics.sql). It includes `BEGIN READ ONLY`, `SET LOCAL duckdb.force_execution=true`, the daily chart's `EXPLAIN (ANALYZE, BUFFERS)`, and `COMMIT`. Do not set DuckDB execution globally: funding, vector queries, and durable activities retain the ordinary Postgres execution path.

All three production aggregates are in [integrations.js](./backend/src/integrations.js). Tests inspect **those exact queries**, require a `DuckDBScan` node, and compare the entire result against an independent calculation. Initial validation also compared all totals, fourteen daily rows, and category rows against the actual running ClickHouse checkpoint.

### Retained durable restart inspection

The 03 restart sequence is still regression-tested, not repeated as the main chapter-04 tour. Use these queries around `docker compose restart postgres` on this same volume:

```sql
SELECT id AS request_uuid, workflow_instance_id, status, risk_score, grant_cents
FROM funding_requests ORDER BY created_at;
SELECT request_id, message, created_at FROM workflow_events ORDER BY id;
SELECT workflow_instance_id, last_success_at FROM scheduled_work;
SELECT id, label, root_node, status, created_at FROM df.instances ORDER BY created_at;
SELECT df.status(workflow_instance_id) FROM funding_requests WHERE project_id = 1;
SELECT * FROM df.list_instances();
SELECT pg_postmaster_start_time();
```

After the restart, repeat those exact queries. The funding instance's `id`, `root_node`, and `created_at` must be unchanged while `pg_postmaster_start_time()` changes. After approval, `df.status()` must show completion, not merely a completed application row.

The implementation is in [05-durable-workflows.sql](./database/05-durable-workflows.sql):

- SQL eligibility and risk activities persist their results, then a `df.wait_for_signal('approval')` node waits for the human.
- `df.start()` joins the caller's transaction, so request creation and durable submission commit together.
- `df.signal()` uses a separate engine connection. The API therefore records the decision and starts a small **durable signal-handoff workflow** in one transaction. It signals only after commit and retries with a one-second durable backoff until the funding row acknowledges completion. This covers approvals arriving before the signal subscription is ready; it is delivery retry, not a presenter sleep. The handoff replaces the old outbox publisher without pretending signals are transactionally atomic or delivered exactly once.
- SQL activities guard persisted state, so retrying an ambiguous completion does not duplicate fake grants or timeline events. Real external side effects would need their own suitable idempotency.
- A persisted `df.loop` with `df.sleep(5)` still owns expiration and cache cleanup. The HTTP refresh node and its status plumbing were removed. Failed SQL iterations remain observable; API health fails when maintenance has not completed a successful tick for 30 seconds.

The SQL worker is still software inside Postgres. Fewer containers do not remove retries, connection budgets, history retention, operational responsibility, or workload contention.

### Retained checkpoint-01 query-plan spotlight

These files are copied unchanged for independent reproducibility. They are not another tour in chapter 04.

In the Microsoft PostgreSQL extension, open and execute these prepared files in order:

1. [01-prepare.sql](./scripts/sql/01-prepare.sql): create **40,008 search-only fixture rows** in `search_demo.projects`, separate from the app. It resets only this named rehearsal table.
2. [02-before.sql](./scripts/sql/02-before.sql): compute the full-text document for every row at query time; inspect its `EXPLAIN (ANALYZE, BUFFERS)` plan.
3. [03-improve.sql](./scripts/sql/03-improve.sql): index the stored document with GIN and update statistics.
4. [04-after.sql](./scripts/sql/04-after.sql): use the stored document/index and inspect the new plan. Both return the same two matches, IDs **2** and **7**.

On the implementation laptop, the before plan was `Gather → Parallel Seq Scan` at approximately **679 ms**, and the after plan was `Bitmap Heap Scan → Bitmap Index Scan` at approximately **0.02 ms**. These are rehearsal observations, not a performance promise. No planner settings were forced. The real eight-row product table may correctly use a sequential scan; the larger, explicitly separate fixture makes the improvement visible without changing product data.

The prepared improvement is the same stored-vector/GIN approach already used by the running app in [03-search-and-cache.sql](./database/03-search-and-cache.sql). Repeat preparation to rehearse again. Resetting checkpoint 04 also removes the optional fixture. No cache speed contest or separate cache crash demo is included.

Disclose the speaker's Microsoft affiliation and involvement in the extension. No finale compatibility is claimed here.

## Tests and development

The complete stack is required for integration tests. They deliberately mutate **only local demo data** and expect a fresh reset.

```sh
cd backend
npm ci
npm run check
npm test
npm run test:integration
npm run test:postgres
npm run test:search-plan
node --test test/vectors.js
node --test test/workflows.js
node --test test/durable-restart.js
node --test test/analytics.js

cd ../frontend
npm ci
npm run build
# Optional frontend development against the running Compose API:
npm run dev
```

The committed lockfiles pin transitive packages. The UI uses system fonts and original inline SVG artwork. `npm ci` and builds need network access only during preparation; `start` does not use npm or a registry.

Both application manifests and lockfiles are unchanged from 03. The original Express/body-parser advisory GHSA-27r3-jxmh-p828 and mitigation remain: request-body decompression is disabled (`inflate: false`), and integration tests verify compressed JSON is rejected with HTTP 415. Keep this local-only stack off public networks.

The retained product/cache/vector/workflow tests pass with the three extensions loaded together. The obsolete refresh route now returns 404. The same-instance restart still completes BreadOps for **$1,800** without duplicate events. Analytics tests cover real DuckDB plans, full result/JSON shape equivalence, UTC behavior under another session timezone, transaction-local routing after success **and failure**, disabled cloud/download features, and responsiveness. Reset afterward for fresh demo data.

Observed warm full-dashboard queries took approximately **13–14 ms** on this laptop's actual prepared dataset of eight projects and 874 backings. The test requires comfortably less than the five-second polling interval. This is a local rehearsal observation, **not** evidence that embedding DuckDB outperforms a production warehouse.

## Where the work lives, and what can fail

- **Money is simulated; authorization is not implemented.** This is a loopback-only presenter demo with a shared demo-founder identity. Anyone who can reach it can back projects, approve grants, or invoke the deadline control. Do not expose it publicly, use real personal data, or connect it to payment systems.
- Postgres transactions and row locks protect backing counts. Client UUIDs provide request idempotency. Funding graphs and human-decision handoffs are durably submitted with the application transaction. This is not a universal exactly-once claim.
- One funding request per project keeps the tour predictable. The eight-character pg_durable instance ID is distinct from the request UUID. Restart the same database/volume at approval wait; resetting or switching checkpoints is not the restart demonstration.
- **The cache is disposable, not crash-safe, and not replicated to standbys.** A miss regenerates it from logged project data. Reads ignore expired rows immediately; the pg_durable maintenance loop removes expired rows.
- A generated, weighted English `tsvector` and GIN index own keyword search. SQL writes maintain the document automatically. Cache-invalidation triggers run in the same project-write transaction, including backing, expiration, and direct SQL changes. A shared transaction advisory lock serializes cache refill/invalidation, preventing a concurrent refill from leaving a stale entry. This trades some lock contention for simple, consistent small-workload behavior.
- Embeddings are now regular project data in `vector(6)` columns. The same seeded arrays are converted during database initialization, not uploaded to a vector service on API startup. Cosine queries are parameterized SQL; no vector client, external HTTP request, or upload loop remains.
- Six vector dimensions are hand-authored features, **not production-quality model embeddings**. Preset semantic queries are checked into the API. Real pgvector similarity is demonstrated without claiming arbitrary natural-language understanding or using inference.
- Eight projects use an **exact cosine scan**, not an approximate-nearest-neighbor index. No HNSW/IVFFlat index or vector speed contest is added. Larger datasets need workload-specific measurements of latency, recall, memory, index maintenance, and contention with transactions; a separate vector service can still be appropriate.
- The three analytics aggregates now read the current, ordinary Postgres tables through pg_duckdb; this does not turn the base tables into columnar storage. Routing uses `SET LOCAL` in a read-only repeatable-read transaction and resets on commit/rollback, so pooled connections do not force funding/vector queries into DuckDB. No snapshot copies or duplicate-ingestion bookkeeping remain.
- Maintenance checks persisted deadlines, so missed ticks catch up after restart. Engine failures remain observable in `df.status`, `df.list_instances`, execution history, and Postgres logs. Failed/cancelled funding workflows surface in the UI; stale maintenance fails the API health check.
- Service failures remain service failures. Inspect `./scripts/demo logs` and `./scripts/demo status`; there is no fallback that makes a failed search engine look healthy.
- Analytics now competes with search, vectors, workflows, and transactions for database CPU, memory, I/O, connections, and locks. This demo sets `duckdb.max_memory=256` MB and `duckdb.threads=2` **per connection**, not as a whole-server memory cap. Larger scans, independent scaling, concurrency, and workload isolation can justify a separate warehouse. Keep failures observable and retain a path to split workloads later.

## Changes from the previous checkpoint

- Removed ClickHouse, its volume and entire configuration directory, credential settings, HTTP warehouse client, snapshot helper, startup setup, refresh endpoint/key, and durable HTTP refresh step.
- Replaced the existing analytics SQL with three standard aggregates dispatched to pg_duckdb. The API payload and existing chart are preserved; freshness/source labels intentionally change.
- Added digest-pinned native pg_duckdb artifacts to the existing independently buildable database image, with license notices. No new application package or dependency version.
- Kept all funding graph/rule SQL, search/cache/vector SQL, seed data, product rules, artwork, and chart logic unchanged. Only maintenance's warehouse work was subtracted.
- Disabled pg_durable HTTP and DuckDB cloud/automatic-download capabilities. Updated tests, the existing diagram, and this runbook; no new feature tour or UI framework.

## Not implemented here

Checkpoints 05 and 06, the slide site, Pages publication, recordings, and the plv8/React/HTTP feasibility spike remain outstanding. This image proves pg_duckdb with pg_durable and pgvector, not the full finale extension set. A one-instance React/HTTP finale is still **unverified**.

No fallback recording is claimed to exist. For this chapter, capture the old dashboard, the prepared checkpoint switch, the same chart with its new source, a real DuckDB plan, a committed backing reflected after refresh, and the three-container diagram. The separate durable-restart recording remains outstanding too.
