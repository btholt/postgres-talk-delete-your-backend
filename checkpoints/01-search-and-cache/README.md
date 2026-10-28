# 01 · Search and cache inside Postgres

The same **Kickstopper** app as checkpoint 00, with Redis and Meilisearch subtracted. Postgres now handles keyword search and the disposable project-summary cache. There are no new runtime dependencies, extensions, or product features.

## Run it

Requirements: Docker Desktop with Compose v2 or later, ports **3000**, **3001**, and **54320** available, and approximately 8 GB assigned to Docker. The pinned service images publish native `linux/arm64` and `linux/amd64` manifests. Application builds use Node **24.15.0**. No payment provider, inference API, account, CDN, or downloaded font is used at runtime.

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

Open **http://localhost:3000**. Startup waits for service health, vector loading, and an initial analytics snapshot. Full-text search and cache setup are part of database initialization. The Compose project is always `kickstopper-01-search-and-cache`; no global Docker context or other project's containers are modified.

All eight services use `restart: unless-stopped`. Explicitly stopped containers remain stopped until `./scripts/demo start`. Readiness after a Docker restart can take time; the runner waits for health before reporting success. `prepare --local` skips image pulls, but an uncached application dependency or base image can still need network access during build. `start` never pulls or builds.

```sh
./scripts/demo status
./scripts/demo logs
./scripts/demo stop                  # Preserves database, queue, index and warehouse volumes.
./scripts/demo start                 # Same data, not a reset.

# Explicitly destructive, limited to this checkpoint's four named demo volumes.
./scripts/demo reset --confirm-delete-demo-data
```

`reset` without the confirmation flag refuses to run. Reset recreates the deterministic project data and clears pledges, funding requests, and the expiration rehearsal. Initial deadlines and backing timestamps are relative to the reset date; names, IDs, amounts, vectors, and the distribution of historical data are deterministic.

From the repository root:

```sh
./scripts/demo prepare 01 --local
./scripts/demo stop 00
./scripts/demo start 01
```

Stop the previous checkpoint first because public ports are unchanged. This is a **prepared transition, not a live data migration**. Checkpoint 00's volumes and images are not reused or reset. You can copy this directory elsewhere and use its own runner without any neighboring checkpoint.

## The actual service inventory

| Logical box | Compose container(s) | Working responsibility |
|---|---|---|
| Frontend host | `frontend` | Nginx 1.28.0 serves the locally built React 19.1.1 app and proxies `/api` |
| Express API | `api` | Node 24.15.0, Express 5.3.0: handwritten HTTP routes and transactions |
| Queue | `queue`, **`worker`** | RabbitMQ 4.1.4 and an explicit Node process: funding eligibility, fake risk, human approval, final grant |
| Scheduler | `scheduler` | Same Node process: campaign expiration, expired-cache cleanup, analytics replication every five seconds |
| Vector database | `vectors` | Qdrant 1.15.4: real cosine similarity over prepared six-dimensional vectors |
| Analytics warehouse | `warehouse` | ClickHouse 25.8.4.13: dashboard totals, daily pledges, category breakdowns |
| Relational database + search/cache | `postgres` | PostgreSQL 17.6: same transactional data, plus generated search documents, GIN index, UNLOGGED summaries |

**Six surrounding responsibilities, seven surrounding containers, plus Postgres: eight total, down from ten.** The worker remains visibly grouped with the queue. The in-app **Under the hood** page removes the search/cache boxes and grows Postgres with `Search. Cache.` labels. Request highlights are scripted explanations, not telemetry.

Only Nginx, the API, and Postgres bind host ports, all on loopback. RabbitMQ, Qdrant, and ClickHouse remain internal Compose services. Redis and Meilisearch are absent, not merely stopped or hidden. The credentials are intentionally public disposable examples.

## Demonstration: same features, fewer services

1. **Discover:** browse the eight seeded projects and open **Honk**. This is the finished product.
2. Search **sourdough**. BreadOps and Crumb & Go still appear. The source now says `Postgres full-text search + UNLOGGED cache`.
3. Clear search. Choose **Find my kind of weird**, then **Less busywork, fewer meetings**. Stand-in ranks first, followed by Reply All.
4. Open Honk, choose **Back this questionable idea**, and pledge **$25**. Pledged dollars and believers increase once. No money moves.
5. Choose **Request funding**. The Funding desk shows a persistent instance UUID, completed eligibility check, deterministic fake risk score **32/100**, and **Needs a human**.
6. Select **Approve fake grant**. The worker records a simulated **$2,500** grant, with a visible event trail. The grant is a workflow record, not a backing or external payout.
7. Open **Analytics**. The backing appears after the scheduler's next five-second refresh. Queries execute in ClickHouse, not Postgres.
8. Open **Under the hood**. Search/cache boxes are gone. Postgres is larger; funding, vectors, and analytics remain outside it. **SHIP IT. For this workload.**

The product screens, route/response shapes, project IDs, seed data, prepared vectors, worker, and money rules are unchanged. English full-text search does use different matching/ranking semantics: stemming and web-search operators work, but Meilisearch typo tolerance and implicit prefix matching do not. The rehearsed search returns the same projects. Semantic search is still Qdrant.

Optional scheduling demo: on **Under the hood**, choose **Make WalkBlock due**. Its deadline moves to now immediately; its status changes from `active` to `expired` only when the separate scheduler runs. The displayed state polls every five seconds. Backing is refused after the deadline, even before the scheduler updates status. Analytics eventually reports one expired project.

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

Reconnect after switching checkpoints: the port and database name are the same, but the persistent database volume is different. Refresh schema exploration to see `projects.search_document`, `projects_search_document_idx`, `project_summary_cache`, `project_summaries()`, and the invalidation triggers.

```sql
SELECT id, name, pledged_cents, backers_count, status FROM projects ORDER BY id;
SELECT id, name, search_document FROM projects ORDER BY id;
SELECT key, expires_at, jsonb_array_length(value) AS projects FROM project_summary_cache;
SELECT * FROM project_summaries(); -- miss when empty/expired, then hit
SELECT relpersistence FROM pg_class WHERE oid = 'project_summary_cache'::regclass; -- u: UNLOGGED
```

### Query-plan spotlight

The stage presentation uses the [product-search replacement walkthrough](../../demo.md#gin-demo): the same app results, the real full-text query, the stored document/GIN definition, and the removed service box. It does not run the larger fixture or an index-speed demonstration. The original four-file sequence below remains optional development material; it also removes read-time document construction, so its overall timing improvement is not an index-only comparison.

In the Microsoft PostgreSQL extension, open and execute these prepared files in order:

1. [01-prepare.sql](./scripts/sql/01-prepare.sql): create **40,008 search-only fixture rows** in `search_demo.projects`, separate from the app. It resets only this named rehearsal table.
2. [02-before.sql](./scripts/sql/02-before.sql): compute the full-text document for every row at query time; inspect its `EXPLAIN (ANALYZE, BUFFERS)` plan.
3. [03-improve.sql](./scripts/sql/03-improve.sql): index the stored document with GIN and update statistics.
4. [04-after.sql](./scripts/sql/04-after.sql): use the stored document/index and inspect the new plan. Both return the same two matches, IDs **2** and **7**.

On the implementation laptop, the before plan was `Gather → Parallel Seq Scan` at approximately **679 ms**, and the after plan was `Bitmap Heap Scan → Bitmap Index Scan` at approximately **0.02 ms**. These are rehearsal observations, not a performance promise. No planner settings were forced. The real eight-row product table may correctly use a sequential scan; the larger, explicitly separate fixture makes the improvement visible without changing product data.

The prepared improvement is the same stored-vector/GIN approach already used by the running app in [03-search-and-cache.sql](./database/03-search-and-cache.sql). Repeat preparation to rehearse again. Resetting checkpoint 01 also removes the optional fixture. No cache speed contest or crash demo is included.

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

cd ../frontend
npm ci
npm run build
# Optional frontend development against the running Compose API:
npm run dev
```

The committed lockfiles pin transitive packages. The UI uses system fonts and original inline SVG artwork. `npm ci` and builds need network access only during preparation; `start` does not use npm or a registry.

Package versions are unchanged from checkpoint 00; only the Redis dependency and its lockfile entries were removed. The original Express/body-parser advisory GHSA-27r3-jxmh-p828 and mitigation remain: request-body decompression is disabled (`inflate: false`), and integration tests verify compressed JSON is rejected with HTTP 415. Keep this local-only stack off public networks and update when an upstream fix is available.

The product-tour test is copied from 00, with only keyword/cache expectations updated. Postgres-specific tests cover UNLOGGED persistence mode, concurrent refill, exact TTL bounds, rejection of expired values, transactional SQL invalidation/rollback, automatic search-document updates, and scheduled cleanup. The plan test executes the prepared SQL files and verifies both result equivalence and a real GIN plan. Reset afterward for fresh demo data.

## Where the work lives, and what can fail

- **Money is simulated; authorization is not implemented.** This is a loopback-only presenter demo with a shared demo-founder identity. Anyone who can reach it can back projects, approve grants, or invoke the deadline control. Do not expose it publicly, use real personal data, or connect it to payment systems.
- Postgres transactions and row locks protect aggregate backing counts. A client-generated UUID provides backing idempotency. A request and its outbox entry commit together, even when RabbitMQ is unavailable.
- The visible worker publishes the outbox using RabbitMQ publisher confirms and durable messages. A crash between broker confirmation and the outbox update can redeliver a job. Guarded state transitions make this demo's repeated jobs harmless. This is **at-least-once**, not magical exactly-once delivery. There are no real external side effects.
- The funding request UUID persists in Postgres; one request per project keeps the opening demo predictable. Restarting this stack is **not** evidence of pg_durable behavior. That is a later, unproven checkpoint.
- **The cache is disposable, not crash-safe, and not replicated to standbys.** Postgres truncates UNLOGGED contents after an unclean restart; a miss regenerates everything from logged project data. Reads ignore expired rows immediately. The existing scheduler deletes expired rows every five seconds, so expiry does not depend on a new service.
- A generated, weighted English `tsvector` and GIN index own keyword search. SQL writes maintain the document automatically. Cache-invalidation triggers run in the same project-write transaction, including backing, expiration, and direct SQL changes. A shared transaction advisory lock serializes cache refill/invalidation, preventing a concurrent refill from leaving a stale entry. This trades some lock contention for simple, consistent small-workload behavior.
- Qdrant vectors are still prepared at API startup. Project metadata editing is intentionally not a new product feature. No external search/cache client or startup indexing loop remains.
- Six vector dimensions are hand-authored features, **not production-quality model embeddings**. Preset semantic queries are checked into the API. Real Qdrant similarity is demonstrated without making claims about arbitrary natural-language understanding.
- ClickHouse receives complete small-data snapshots on each scheduler tick. `ReplacingMergeTree` tables queried with `FINAL` avoid duplicate aggregation after repeated copies. Dashboard data is eventually consistent and may lag a tick. This simple replication is not production CDC; a large dataset would require incremental ingestion, backpressure, and observability.
- The scheduler polls deadlines from Postgres, so missed ticks are caught after restart. Failures are logged, and its health becomes unhealthy if no tick succeeds within 30 seconds.
- Service failures remain service failures. Inspect `./scripts/demo logs` and `./scripts/demo status`; there is no fallback that makes a failed search engine look healthy.
- Search and caching now compete with transactions for Postgres CPU, memory, I/O, connections, and locks. This is a replacement for this app's tiny regenerable summary cache, **not a blanket Redis replacement**. Independent scaling, richer search semantics, or high cache traffic can justify separating them again. The remaining queue and warehouse still have their own delivery/replication semantics.

## Changes from the previous checkpoint

- Removed two Compose services, one search volume, their environment settings, the Redis npm dependency, Meilisearch preparation, Redis connection lifecycle, and application-managed cache invalidation.
- Added one database setup file for indexed full-text search, UNLOGGED cache refill/expiry, and transactional invalidation. The integrations module keeps its original role; the scheduler gains one expired-row cleanup query.
- Kept the rest of the app copied verbatim except checkpoint/source/architecture labels, a one-line Postgres diagram-size change, and keyword/cache test expectations. No shared runtime code, migrations, UI rewrite, or new framework.
- Added optional SQL rehearsal files and focused tests. The local runner is unchanged apart from checkpoint naming and `prepare --local` to skip image pulls.

## Not implemented here

Checkpoints 02 through 06, the slide site, Pages publication, recordings, the plv8/React/HTTP feasibility spike, and pg_durable compatibility/restart proof remain outstanding. A one-instance finale is still **unverified**. This checkpoint proves only this search/cache consolidation.
