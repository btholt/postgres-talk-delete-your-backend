# 02 · Vectors inside Postgres

The same **Kickstopper** app as checkpoint 01, with Qdrant subtracted. Postgres now handles similarity search using **pgvector 0.8.1**, alongside the existing full-text search and summary cache. The checked-in vectors, presets, product behavior, and npm dependencies are unchanged.

## Run it

Requirements: Docker Desktop with Compose v2 or later, ports **3000**, **3001**, and **54320** available, and approximately 8 GB assigned to Docker. The pinned service images publish native `linux/arm64` and `linux/amd64` manifests. Application builds use Node **24.15.0**. No payment provider, inference API, account, CDN, or downloaded font is used at runtime.

One new image is necessary: `pgvector/pgvector:0.8.1-pg17`, pinned to the multi-architecture digest `sha256:3e8b3adfd27b5707128f60956f62a793c3c9326ea8cfaf0eab7adccb5d700b21`. It contains **Postgres 17.8 on Debian** rather than checkpoint 01's Postgres 17.6 Alpine image. Native ARM64 operation and the extension version were verified. No other service image versions change.

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

Open **http://localhost:3000**. Startup waits for service health and an initial analytics snapshot. Full-text search, cache, and vector setup are part of database initialization; there is no vector-service upload. The Compose project is always `kickstopper-02-vectors`; no global Docker context or other project's containers are modified.

All seven services use `restart: unless-stopped`. Explicitly stopped containers remain stopped until `./scripts/demo start`. Readiness after a Docker restart can take time; the runner waits for health before reporting success. `prepare --local` skips image pulls, but an uncached application dependency or base image can still need network access during build. `start` never pulls or builds.

```sh
./scripts/demo status
./scripts/demo logs
./scripts/demo stop                  # Preserves database, queue and warehouse volumes.
./scripts/demo start                 # Same data, not a reset.

# Explicitly destructive, limited to this checkpoint's three named demo volumes.
./scripts/demo reset --confirm-delete-demo-data
```

`reset` without the confirmation flag refuses to run. Reset recreates the deterministic project data and clears pledges, funding requests, and the expiration rehearsal. Initial deadlines and backing timestamps are relative to the reset date; names, IDs, amounts, vectors, and the distribution of historical data are deterministic.

From the repository root:

```sh
# If 01 is already prepared, pull only the newly required database image:
docker compose -f checkpoints/02-vectors/compose.yaml pull postgres
./scripts/demo prepare 02 --local
./scripts/demo stop 01
./scripts/demo start 02
```

Stop the previous checkpoint first because public ports are unchanged. This is a **prepared transition, not a live data migration**. Checkpoints 00 and 01 have separate volumes and images; none are reused or reset. You can copy this directory elsewhere and use its own runner without any neighboring checkpoint.

## The actual service inventory

| Logical box | Compose container(s) | Working responsibility |
|---|---|---|
| Frontend host | `frontend` | Nginx 1.28.0 serves the locally built React 19.1.1 app and proxies `/api` |
| Express API | `api` | Node 24.15.0, Express 5.3.0: handwritten HTTP routes and transactions |
| Queue | `queue`, **`worker`** | RabbitMQ 4.1.4 and an explicit Node process: funding eligibility, fake risk, human approval, final grant |
| Scheduler | `scheduler` | Same Node process: campaign expiration, expired-cache cleanup, analytics replication every five seconds |
| Analytics warehouse | `warehouse` | ClickHouse 25.8.4.13: dashboard totals, daily pledges, category breakdowns |
| Relational database + search/cache/vectors | `postgres` | PostgreSQL 17.8 + pgvector 0.8.1: same transactional data, full-text search, UNLOGGED summaries, and `vector(6)` cosine similarity |

**Five surrounding responsibilities, six surrounding containers, plus Postgres: seven total, down from eight in 01 and ten in 00.** The worker remains visibly grouped with the queue. The in-app **Under the hood** page removes Qdrant's box and grows Postgres with a `Vectors.` label. Request highlights are scripted explanations, not telemetry.

Only Nginx, the API, and Postgres bind host ports, all on loopback. RabbitMQ and ClickHouse remain internal Compose services. Redis, Meilisearch, and Qdrant are absent, not merely stopped or hidden. The credentials are intentionally public disposable examples.

## Demonstration: same features, fewer services

Keep this chapter short: use step 3, the SQL similarity query below, and step 8. The rest of the tour is retained for regression/rehearsal, not an additional feature demonstration.

1. **Discover:** browse the eight seeded projects and open **Honk**. This is the finished product.
2. Search **sourdough**. BreadOps and Crumb & Go still appear. The source now says `Postgres full-text search + UNLOGGED cache`.
3. Clear search. Choose **Find my kind of weird**, then **Less busywork, fewer meetings**. Stand-in still ranks first, followed by Reply All, now sourced from Postgres + pgvector. Choose the bread preset: BreadOps and Crumb & Go lead. Open BreadOps: Crumb & Go is still its closest related project.
4. Open Honk, choose **Back this questionable idea**, and pledge **$25**. Pledged dollars and believers increase once. No money moves.
5. Choose **Request funding**. The Funding desk shows a persistent instance UUID, completed eligibility check, deterministic fake risk score **32/100**, and **Needs a human**.
6. Select **Approve fake grant**. The worker records a simulated **$2,500** grant, with a visible event trail. The grant is a workflow record, not a backing or external payout.
7. Open **Analytics**. The backing appears after the scheduler's next five-second refresh. Queries execute in ClickHouse, not Postgres.
8. Open **Under the hood**. Qdrant's box is gone. Postgres is larger and includes vectors; funding and analytics remain outside it. **SHIP IT. For this workload.**

The product screens, route/response shapes, project IDs, seed data, prepared vectors, worker, and money rules are unchanged. All four preset queries and all eight project-similarity queries were compared against the real checkpoint-01 Qdrant baseline: identical rankings, with score differences below `0.000001` (largest observed difference about `0.0000002`). The English full-text matching differences documented in 01 remain unchanged.

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

Reconnect after switching checkpoints: the port and database name are the same, but the persistent database volume is different. Refresh schema exploration to see the `vector` extension and `projects.embedding` as `vector(6)`. Search/cache objects from 01 remain unchanged.

```sql
SELECT id, name, pledged_cents, backers_count, status FROM projects ORDER BY id;
SELECT id, name, search_document FROM projects ORDER BY id;
SELECT key, expires_at, jsonb_array_length(value) AS projects FROM project_summary_cache;
SELECT * FROM project_summaries(); -- miss when empty/expired, then hit
SELECT relpersistence FROM pg_class WHERE oid = 'project_summary_cache'::regclass; -- u: UNLOGGED
```

The short vector reveal:

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
SELECT id, name, embedding FROM projects ORDER BY id;

SELECT id, name,
  1 - (embedding <=> (SELECT embedding FROM projects WHERE id = 2)) AS similarity
FROM projects
WHERE id <> 2
ORDER BY embedding <=> (SELECT embedding FROM projects WHERE id = 2), id
LIMIT 4;
```

Crumb & Go (ID 7) is first, matching BreadOps's related-ideas section. `<=>` is cosine distance; the API returns `1 - distance` so the UI still shows similarity, not distance. There is no live embedding API and no browser database connection.

The only new setup is [04-vectors.sql](./database/04-vectors.sql): install pgvector in this database and convert the original seeded JSON arrays to `vector(6)`. This is initialization of a separate checkpoint, not migration of the previous checkpoint's database.

### Retained checkpoint-01 query-plan spotlight

These files are copied unchanged for independent reproducibility. They are not another tour in chapter 02.

In the Microsoft PostgreSQL extension, open and execute these prepared files in order:

1. [01-prepare.sql](./scripts/sql/01-prepare.sql): create **40,008 search-only fixture rows** in `search_demo.projects`, separate from the app. It resets only this named rehearsal table.
2. [02-before.sql](./scripts/sql/02-before.sql): compute the full-text document for every row at query time; inspect its `EXPLAIN (ANALYZE, BUFFERS)` plan.
3. [03-improve.sql](./scripts/sql/03-improve.sql): index the stored document with GIN and update statistics.
4. [04-after.sql](./scripts/sql/04-after.sql): use the stored document/index and inspect the new plan. Both return the same two matches, IDs **2** and **7**.

On the implementation laptop, the before plan was `Gather → Parallel Seq Scan` at approximately **679 ms**, and the after plan was `Bitmap Heap Scan → Bitmap Index Scan` at approximately **0.02 ms**. These are rehearsal observations, not a performance promise. No planner settings were forced. The real eight-row product table may correctly use a sequential scan; the larger, explicitly separate fixture makes the improvement visible without changing product data.

The prepared improvement is the same stored-vector/GIN approach already used by the running app in [03-search-and-cache.sql](./database/03-search-and-cache.sql). Repeat preparation to rehearse again. Resetting checkpoint 02 also removes the optional fixture. No cache speed contest or crash demo is included.

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

cd ../frontend
npm ci
npm run build
# Optional frontend development against the running Compose API:
npm run dev
```

The committed lockfiles pin transitive packages. The UI uses system fonts and original inline SVG artwork. `npm ci` and builds need network access only during preparation; `start` does not use npm or a registry.

Both package manifests and lockfiles are byte-for-byte unchanged from checkpoint 01. The original Express/body-parser advisory GHSA-27r3-jxmh-p828 and mitigation remain: request-body decompression is disabled (`inflate: false`), and integration tests verify compressed JSON is rejected with HTTP 415. Keep this local-only stack off public networks and update when an upstream fix is available.

The product-tour/cache tests are copied from 01 with only checkpoint/vector labels changed. The additional vector tests verify extension version, six-dimensional storage, all 12 original rankings, cosine scores against an independent calculation, self-exclusion, and explicit invalid-input errors. Search/cache and the GIN plan spotlight are regression-tested too. Reset afterward for fresh demo data.

## Where the work lives, and what can fail

- **Money is simulated; authorization is not implemented.** This is a loopback-only presenter demo with a shared demo-founder identity. Anyone who can reach it can back projects, approve grants, or invoke the deadline control. Do not expose it publicly, use real personal data, or connect it to payment systems.
- Postgres transactions and row locks protect aggregate backing counts. A client-generated UUID provides backing idempotency. A request and its outbox entry commit together, even when RabbitMQ is unavailable.
- The visible worker publishes the outbox using RabbitMQ publisher confirms and durable messages. A crash between broker confirmation and the outbox update can redeliver a job. Guarded state transitions make this demo's repeated jobs harmless. This is **at-least-once**, not magical exactly-once delivery. There are no real external side effects.
- The funding request UUID persists in Postgres; one request per project keeps the opening demo predictable. Restarting this stack is **not** evidence of pg_durable behavior. That is a later, unproven checkpoint.
- **The cache is disposable, not crash-safe, and not replicated to standbys.** Postgres truncates UNLOGGED contents after an unclean restart; a miss regenerates everything from logged project data. Reads ignore expired rows immediately. The existing scheduler deletes expired rows every five seconds, so expiry does not depend on a new service.
- A generated, weighted English `tsvector` and GIN index own keyword search. SQL writes maintain the document automatically. Cache-invalidation triggers run in the same project-write transaction, including backing, expiration, and direct SQL changes. A shared transaction advisory lock serializes cache refill/invalidation, preventing a concurrent refill from leaving a stale entry. This trades some lock contention for simple, consistent small-workload behavior.
- Embeddings are now regular project data in `vector(6)` columns. The same seeded arrays are converted during database initialization, not uploaded to a vector service on API startup. Cosine queries are parameterized SQL; no vector client, external HTTP request, or upload loop remains.
- Six vector dimensions are hand-authored features, **not production-quality model embeddings**. Preset semantic queries are checked into the API. Real pgvector similarity is demonstrated without claiming arbitrary natural-language understanding or using inference.
- Eight projects use an **exact cosine scan**, not an approximate-nearest-neighbor index. No HNSW/IVFFlat index or vector speed contest is added. Larger datasets need workload-specific measurements of latency, recall, memory, index maintenance, and contention with transactions; a separate vector service can still be appropriate.
- ClickHouse receives complete small-data snapshots on each scheduler tick. `ReplacingMergeTree` tables queried with `FINAL` avoid duplicate aggregation after repeated copies. Dashboard data is eventually consistent and may lag a tick. This simple replication is not production CDC; a large dataset would require incremental ingestion, backpressure, and observability.
- The scheduler polls deadlines from Postgres, so missed ticks are caught after restart. Failures are logged, and its health becomes unhealthy if no tick succeeds within 30 seconds.
- Service failures remain service failures. Inspect `./scripts/demo logs` and `./scripts/demo status`; there is no fallback that makes a failed search engine look healthy.
- Search, caching, and vectors now compete with transactions for Postgres CPU, memory, I/O, connections, and locks. The tiny summary cache is **not a blanket Redis replacement**, and pgvector does not erase vector operations. Independent scaling or workload isolation can justify separating responsibilities again. The remaining queue and warehouse still have their own delivery/replication semantics.

## Changes from the previous checkpoint

- Removed the Qdrant service, volume, environment setting, HTTP wrapper, and startup preparation.
- Added a four-line SQL setup file and a small cosine query in the existing integrations module. The API's existing similarity route retains its response shape and prepared presets.
- Switched only the database image to the digest-pinned pgvector/Postgres image. Application packages and lockfiles, seed files, search/cache SQL, scheduler, worker, business rules, artwork, and UI helpers are unchanged.
- Updated checkpoint/vector source labels and the existing diagram, plus focused vector tests. The local runner changes only its reset project name; no new build tooling or framework.

## Not implemented here

Checkpoints 03 through 06, the slide site, Pages publication, recordings, the plv8/React/HTTP feasibility spike, and pg_durable compatibility/restart proof remain outstanding. A one-instance finale is still **unverified**. This checkpoint proves only the search/cache/vector consolidation.
