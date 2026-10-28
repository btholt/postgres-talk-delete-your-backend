# 00 · The original architecture

**Kickstopper** is crowdfunding for terrible startup ideas. The money is fake; the service responsibilities are not. This is the complete starting checkpoint, not the consolidated Postgres implementation.

## Run it

Requirements: Docker Desktop with Compose v2 or later, ports **3000**, **3001**, and **54320** available, and approximately 8 GB assigned to Docker. The pinned service images publish native `linux/arm64` and `linux/amd64` manifests. Application builds use Node **24.15.0**. No payment provider, inference API, account, CDN, or downloaded font is used at runtime.

From this directory:

```sh
# Optional: the committed defaults already work for disposable local data.
cp .env.example .env

# Do this online before the event. Pull services and build both application images.
./scripts/demo prepare

# Intentionally refuses image pulls or builds. Works offline after preparation.
./scripts/demo start
```

Open **http://localhost:3000**. Startup waits for service health, search indexing, vector loading, and an initial analytics snapshot. The Compose project is always `kickstopper-00-original`; no global Docker context or other project's containers are modified.

All ten services use `restart: unless-stopped`, so Docker restarts do not bring back the app without its supporting services. Explicitly stopped containers remain stopped until `./scripts/demo start`. Readiness after a Docker restart can take time; the runner waits for health before reporting success.

```sh
./scripts/demo status
./scripts/demo logs
./scripts/demo stop                  # Preserves database, queue, index and warehouse volumes.
./scripts/demo start                 # Same data, not a reset.

# Explicitly destructive, limited to this checkpoint's five named demo volumes.
./scripts/demo reset --confirm-delete-demo-data
```

`reset` without the confirmation flag refuses to run. Reset recreates the deterministic project data and clears pledges, funding requests, and the expiration rehearsal. Initial deadlines and backing timestamps are relative to the reset date; names, IDs, amounts, vectors, and the distribution of historical data are deterministic.

From the repository root, the equivalent commands are `./scripts/demo prepare 00`, `./scripts/demo start 00`, etc. You can copy this directory elsewhere and run its own runner without the repository root or any neighboring checkpoint.

## The actual service inventory

| Logical box | Compose container(s) | Working responsibility |
|---|---|---|
| Frontend host | `frontend` | Nginx 1.28.0 serves the locally built React 19.1.1 app and proxies `/api` |
| Express API | `api` | Node 24.15.0, Express 5.3.0: handwritten HTTP routes and transactions |
| Redis cache | `cache` | Redis 8.2.1: regenerable project summaries, 20-second TTL, explicit invalidation |
| Queue | `queue`, **`worker`** | RabbitMQ 4.1.4 and an explicit Node process: funding eligibility, fake risk, human approval, final grant |
| Scheduler | `scheduler` | Separate Node process: expire unsuccessful campaigns and replicate analytics every five seconds |
| Search service | `search` | Meilisearch 1.16.0: real keyword search over project names, pitches, and categories |
| Vector database | `vectors` | Qdrant 1.15.4: real cosine similarity over prepared six-dimensional vectors |
| Analytics warehouse | `warehouse` | ClickHouse 25.8.4.13: dashboard totals, daily pledges, category breakdowns |
| Relational database | `postgres` | PostgreSQL 17.6: projects, backing transactions, funding state, workflow events, transactional outbox |

**Eight surrounding responsibilities, nine surrounding containers, plus Postgres: ten total.** The worker is grouped visibly with the queue, not hidden. The in-app **Under the hood** page uses the same inventory and deliberately triggered conceptual request highlights. These are explanatory paths, not telemetry.

Only Nginx, the API, and Postgres bind host ports, all on loopback. Meilisearch, Redis, RabbitMQ, Qdrant, and ClickHouse are internal Compose services. The credentials are intentionally public disposable examples.

## Opening tour (about 90 seconds)

1. **Discover:** browse the eight seeded projects and open **Honk**. This is the finished product.
2. Search **sourdough**. BreadOps and Crumb & Go appear, via Meilisearch.
3. Clear search. Choose **Find my kind of weird**, then **Less busywork, fewer meetings**. Stand-in ranks first, followed by Reply All.
4. Open Honk, choose **Back this questionable idea**, and pledge **$25**. Pledged dollars and believers increase once. No money moves.
5. Choose **Request funding**. The Funding desk shows a persistent instance UUID, completed eligibility check, deterministic fake risk score **32/100**, and **Needs a human**.
6. Select **Approve fake grant**. The worker records a simulated **$2,500** grant, with a visible event trail. The grant is a workflow record, not a backing or external payout.
7. Open **Analytics**. The backing appears after the scheduler's next five-second refresh. Queries execute in ClickHouse, not Postgres.
8. Open **Under the hood**. Select the request-path buttons. “That's the application. It's finished. Unfortunately, so is the architecture.”

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

Explore `projects`, `backings`, `funding_requests`, `workflow_events`, and `outbox`. Example queries:

```sql
SELECT id, name, pledged_cents, backers_count, status FROM projects ORDER BY id;
SELECT id, project_id, status, risk_score, grant_cents FROM funding_requests;
SELECT request_id, message, created_at FROM workflow_events ORDER BY id;
SELECT id, request_id, kind, published_at FROM outbox ORDER BY id;
```

The speaker's Microsoft affiliation should be disclosed in the eventual presentation. No extension tooling or finale compatibility is claimed by this checkpoint.

## Tests and development

The complete stack is required for integration tests. They deliberately mutate **only local demo data** and expect a fresh reset.

```sh
cd backend
npm ci
npm run check
npm test
npm run test:integration

cd ../frontend
npm ci
npm run build
# Optional frontend development against the running Compose API:
npm run dev
```

The committed lockfiles pin transitive packages. The UI uses system fonts and original inline SVG artwork. `npm ci` and builds need network access only during preparation; `start` does not use npm or a registry.

At implementation time, `npm audit` reports GHSA-27r3-jxmh-p828 for Express 5's `body-parser` dependency; the registry does not yet publish the advisory's fixed 2.4.0 version. The API explicitly disables request-body decompression (`inflate: false`) and tests that compressed JSON is rejected with HTTP 415, avoiding the vulnerable compressed-body path. Keep this local-only stack off public networks and update the pin when an upstream fix is available.

The integration test covers actual keyword/vector ordering, Redis hits, concurrent idempotent backing, invalid inputs, queued approval/rejection/ineligibility, expiration, and deduplicated warehouse aggregation. Reset again afterward to restore the opening tour.

## Where the work lives, and what can fail

- **Money is simulated; authorization is not implemented.** This is a loopback-only presenter demo with a shared demo-founder identity. Anyone who can reach it can back projects, approve grants, or invoke the deadline control. Do not expose it publicly, use real personal data, or connect it to payment systems.
- Postgres transactions and row locks protect aggregate backing counts. A client-generated UUID provides backing idempotency. A request and its outbox entry commit together, even when RabbitMQ is unavailable.
- The visible worker publishes the outbox using RabbitMQ publisher confirms and durable messages. A crash between broker confirmation and the outbox update can redeliver a job. Guarded state transitions make this demo's repeated jobs harmless. This is **at-least-once**, not magical exactly-once delivery. There are no real external side effects.
- The funding request UUID persists in Postgres; one request per project keeps the opening demo predictable. Restarting this stack is **not** evidence of pg_durable behavior. That is a later, unproven checkpoint.
- Redis is deliberately disposable: no disk persistence, 20-second expiry, and explicit invalidation on backing/expiration. The API reports service failures rather than silently substituting Postgres for search, vectors, cache, or analytics.
- Keyword documents and vectors are prepared at API startup. Project metadata editing is intentionally not part of the product. Supporting search indexes are recoverable from Postgres.
- Six vector dimensions are hand-authored features, **not production-quality model embeddings**. Preset semantic queries are checked into the API. Real Qdrant similarity is demonstrated without making claims about arbitrary natural-language understanding.
- ClickHouse receives complete small-data snapshots on each scheduler tick. `ReplacingMergeTree` tables queried with `FINAL` avoid duplicate aggregation after repeated copies. Dashboard data is eventually consistent and may lag a tick. This simple replication is not production CDC; a large dataset would require incremental ingestion, backpressure, and observability.
- The scheduler polls deadlines from Postgres, so missed ticks are caught after restart. Failures are logged, and its health becomes unhealthy if no tick succeeds within 30 seconds.
- Service failures remain service failures. Inspect `./scripts/demo logs` and `./scripts/demo status`; there is no fallback that makes a failed search engine look healthy.
- Eight services mean image management, extra volumes, queue delivery semantics, cache invalidation, and replication lag. Separating these workloads is still sensible when isolation, independent scaling, or specialist features justify it. Consolidation will move those responsibilities, not eliminate the underlying software.

## Changes from the previous checkpoint

None. This is the starting point. Checkpoint switching will be a **prepared presentation transition, not a live data migration**. Stop this checkpoint before starting another because the public-facing ports stay the same. Each later checkpoint must have a separate Compose project and persistent database volume, with the same stable project IDs and prepared vectors.

## Not implemented here

Checkpoints 01 through 06, the slide site, Pages publication, recordings, the plv8/React/HTTP feasibility spike, and pg_durable compatibility/restart proof remain outstanding. In particular, a one-instance finale is still **unverified**. This implementation deliberately follows the requested checkpoint-00 scope rather than implying the later feasibility gates have passed.
