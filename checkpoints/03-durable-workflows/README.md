# 03 · Durable workflows inside Postgres

The same **Kickstopper** app as checkpoint 02, with RabbitMQ, its Node worker, and the separate scheduler subtracted. **pg_durable 0.2.9** owns funding workflows and durable maintenance timers inside Postgres. Search, cache, vectors, seed data, and fake-money rules are retained.

## Run it

Requirements: Docker Desktop with Compose v2 or later, ports **3000**, **3001**, and **54320** available, and approximately 8 GB assigned to Docker. Application builds use Node **24.15.0**. No payment provider, inference API, account, CDN, or downloaded font is used at runtime.

The [database Dockerfile](./database/Dockerfile) builds pg_durable natively on the same digest-pinned **Postgres 17.8 + pgvector 0.8.1** image used in 02. It pins pg_durable's `v0.2.9` source commit `2ccb746756e1071b24172b541f7af130166c0c6b`, verifies the source archive SHA-256, and uses Rust **1.94.0** and cargo-pgrx **0.16.1**. Upstream's published pg_durable images are amd64-only; this checkpoint does not silently use emulation on Apple Silicon.

The first source build needs substantial online preparation. Rust/compiler dependencies and Cargo artifacts are cached by Docker for later builds. Downloads use HTTPS with certificate verification. `prepare --local` skips service-image pulls, **not** missing build dependencies. Build before the event, not during the talk.

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

Open **http://localhost:3000**. Startup waits for the pg_durable engine, an initial warehouse snapshot, and the maintenance workflow's first successful refresh. The Compose project is always `kickstopper-03-durable-workflows`; no global Docker context or other project's containers are modified.

All four services use `restart: unless-stopped`. Explicitly stopped containers remain stopped until `./scripts/demo start`. `start` never pulls or builds. A prebuilt-image alternative is to transfer `kickstopper-03-postgres:local` with `docker image save` / `docker image load` between machines of the same architecture, then build the application images locally. No nonexistent upstream ARM64 binary image is assumed.

```sh
./scripts/demo status
./scripts/demo logs
./scripts/demo stop                  # Preserves database and warehouse volumes.
./scripts/demo start                 # Same data, not a reset.

# Explicitly destructive, limited to this checkpoint's two named demo volumes.
./scripts/demo reset --confirm-delete-demo-data
```

`reset` without the confirmation flag refuses to run. Reset recreates the deterministic project data and clears pledges, funding requests, and the expiration rehearsal. Initial deadlines and backing timestamps are relative to the reset date; names, IDs, amounts, vectors, and the distribution of historical data are deterministic.

From the repository root:

```sh
./scripts/demo prepare 03 --local
./scripts/demo stop 02
./scripts/demo start 03
```

Stop the previous checkpoint first because public ports are unchanged. This is a **prepared transition, not a live data migration**. All earlier checkpoints have separate volumes and images; none are reused or reset. This directory is independently buildable and runnable without neighboring checkpoints.

## The actual service inventory

| Logical box | Compose container(s) | Working responsibility |
|---|---|---|
| Frontend host | `frontend` | Nginx 1.28.0 serves the locally built React 19.1.1 app and proxies `/api` |
| Express API | `api` | Same HTTP routes, plus the existing ClickHouse refresh helper exposed as an explicit durable HTTP activity |
| Analytics warehouse | `warehouse` | ClickHouse 25.8.4.13: dashboard totals, daily pledges, category breakdowns |
| Database + search/cache/vectors/workflows/timers | `postgres` | Postgres 17.8, pgvector 0.8.1, pg_durable 0.2.9; its background worker executes durable graphs inside this container |

**Three surrounding responsibilities plus Postgres: four containers, down from seven in 02.** The queue, worker, scheduler, AMQP client, and application outbox table are gone. The diagram grows Postgres with `Workflows. Timers.` and explicitly labels Express's remaining warehouse refresh activity. Request highlights are scripted explanations, not telemetry.

Only Nginx, the API, and Postgres bind host ports, all on loopback. ClickHouse remains internal. There is no hidden Node polling worker or scheduler. Scheduling is in Postgres; the still-visible API executes the unchanged external warehouse copy when pg_durable calls it.

**Local-demo HTTP policy:** `pg_durable.http_security=unrestricted` is explicitly required for HTTP to the internal Compose `api` hostname. This development-only mode permits private-network HTTP and is not a production recommendation. `/internal/analytics/refresh` checks a public local-demo activity key to prevent accidental calls, not to provide production authorization. Do not expose this stack publicly.

## Demonstration: same features, fewer services

The central demonstration is a **restart of this same database and volume**, not a checkpoint switch:

1. Open **Honk** and choose **Request funding**. Wait for **Needs a human** and risk **32/100**.
2. Capture both displayed identifiers: the request UUID and the **actual eight-character pg_durable instance ID**. They are different identifiers.
3. In VS Code, inspect the funding row, event trail, and `df.status()` using the queries below. Eligibility/risk are completed; approval is pending.
4. From this checkpoint directory, run `docker compose restart postgres`. Do **not** run `down`, `reset`, or switch checkpoints. The API and warehouse stay running.
5. Reconnect in VS Code. Query the same request and instance. The risk and completed events remain; the request is still waiting for a human. Wait for maintenance to resume and `./scripts/demo status` to show healthy.
6. Back in the funding desk, select **Approve fake grant**. A simulated **$2,500** grant is recorded on the **same instance**, with exactly one final event. No money moves.
7. Show **Under the hood**: queue, worker, and scheduler boxes are gone. **SHIP IT. For this workload.**

Browse, keyword search, semantic presets, backing, analytics, stable project IDs, and prepared vectors are unchanged. The funding response adds the real `workflow_instance_id`, eligibility state, and an observable workflow status; the UI retains its layout and now distinguishes the request UUID from the durable instance.

Optional scheduling demo: choose **Make WalkBlock due** on Under the hood. Its deadline changes immediately; the existing pg_durable maintenance instance expires it on its next tick. The same loop cleans expired summary-cache entries and invokes the visible Express warehouse activity. Analytics eventually shows one expired project. There is no separate cron container.

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

Reconnect after switching checkpoints: ports and credentials are unchanged, but the persistent database volume is different. Refresh schema exploration to see `pg_durable`, `df.instances`, `df.nodes`, `funding_requests.workflow_instance_id`, `workflow_events`, and `scheduled_work`. Search/cache/vector objects remain.

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
- A persisted `df.loop` with `df.sleep(5)` owns maintenance. The next tick follows the prior iteration, like the old scheduler; it is not a wall-clock cron guarantee. Failed HTTP refreshes are recorded as failed child executions and retried on a later iteration. API health becomes unhealthy when no complete maintenance tick succeeds for 30 seconds.

The SQL worker is still software inside Postgres. Fewer containers do not remove retries, connection budgets, history retention, operational responsibility, or workload contention.

### Retained checkpoint-01 query-plan spotlight

These files are copied unchanged for independent reproducibility. They are not another tour in chapter 03.

In the Microsoft PostgreSQL extension, open and execute these prepared files in order:

1. [01-prepare.sql](./scripts/sql/01-prepare.sql): create **40,008 search-only fixture rows** in `search_demo.projects`, separate from the app. It resets only this named rehearsal table.
2. [02-before.sql](./scripts/sql/02-before.sql): compute the full-text document for every row at query time; inspect its `EXPLAIN (ANALYZE, BUFFERS)` plan.
3. [03-improve.sql](./scripts/sql/03-improve.sql): index the stored document with GIN and update statistics.
4. [04-after.sql](./scripts/sql/04-after.sql): use the stored document/index and inspect the new plan. Both return the same two matches, IDs **2** and **7**.

On the implementation laptop, the before plan was `Gather → Parallel Seq Scan` at approximately **679 ms**, and the after plan was `Bitmap Heap Scan → Bitmap Index Scan` at approximately **0.02 ms**. These are rehearsal observations, not a performance promise. No planner settings were forced. The real eight-row product table may correctly use a sequential scan; the larger, explicitly separate fixture makes the improvement visible without changing product data.

The prepared improvement is the same stored-vector/GIN approach already used by the running app in [03-search-and-cache.sql](./database/03-search-and-cache.sql). Repeat preparation to rehearse again. Resetting checkpoint 03 also removes the optional fixture. No cache speed contest or separate cache crash demo is included.

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

cd ../frontend
npm ci
npm run build
# Optional frontend development against the running Compose API:
npm run dev
```

The committed lockfiles pin transitive packages. The UI uses system fonts and original inline SVG artwork. `npm ci` and builds need network access only during preparation; `start` does not use npm or a registry.

Only the AMQP dependency and its lockfile entries were removed from the backend. The frontend manifest/lockfile are unchanged. The original Express/body-parser advisory GHSA-27r3-jxmh-p828 and mitigation remain: request-body decompression is disabled (`inflate: false`), and integration tests verify compressed JSON is rejected with HTTP 415. Keep this local-only stack off public networks.

The product/cache/vector tests are retained. `workflows.js` checks the moved SQL rules, repeated activities, rollback of a durable signal handoff, cancellation handling, and the explicit warehouse activity guard. `durable-restart.js` starts **BreadOps**, captures its actual durable ID, restarts the same container/volume, verifies completed steps were not duplicated, and approves the same instance for **$1,800**. It deliberately differs from the fresh-Honk manual tour and must not be rerun without reset. Reset afterward for fresh demo data.

## Where the work lives, and what can fail

- **Money is simulated; authorization is not implemented.** This is a loopback-only presenter demo with a shared demo-founder identity. Anyone who can reach it can back projects, approve grants, or invoke the deadline control. Do not expose it publicly, use real personal data, or connect it to payment systems.
- Postgres transactions and row locks protect backing counts. Client UUIDs provide request idempotency. Funding graphs and human-decision handoffs are durably submitted with the application transaction. This is not a universal exactly-once claim.
- One funding request per project keeps the tour predictable. The eight-character pg_durable instance ID is distinct from the request UUID. Restart the same database/volume at approval wait; resetting or switching checkpoints is not the restart demonstration.
- **The cache is disposable, not crash-safe, and not replicated to standbys.** A miss regenerates it from logged project data. Reads ignore expired rows immediately; the pg_durable maintenance loop removes expired rows.
- A generated, weighted English `tsvector` and GIN index own keyword search. SQL writes maintain the document automatically. Cache-invalidation triggers run in the same project-write transaction, including backing, expiration, and direct SQL changes. A shared transaction advisory lock serializes cache refill/invalidation, preventing a concurrent refill from leaving a stale entry. This trades some lock contention for simple, consistent small-workload behavior.
- Embeddings are now regular project data in `vector(6)` columns. The same seeded arrays are converted during database initialization, not uploaded to a vector service on API startup. Cosine queries are parameterized SQL; no vector client, external HTTP request, or upload loop remains.
- Six vector dimensions are hand-authored features, **not production-quality model embeddings**. Preset semantic queries are checked into the API. Real pgvector similarity is demonstrated without claiming arbitrary natural-language understanding or using inference.
- Eight projects use an **exact cosine scan**, not an approximate-nearest-neighbor index. No HNSW/IVFFlat index or vector speed contest is added. Larger datasets need workload-specific measurements of latency, recall, memory, index maintenance, and contention with transactions; a separate vector service can still be appropriate.
- ClickHouse still receives the same small-data snapshots through the existing Express helper, invoked by a durable HTTP activity. The activity is visible in the diagram; no hidden Node worker was added. `ReplacingMergeTree` queries with `FINAL` avoid duplicate aggregation after retries. This is still eventually consistent and not production CDC.
- Maintenance checks persisted deadlines, so missed ticks catch up after restart. Engine failures remain observable in `df.status`, `df.list_instances`, execution history, and Postgres logs. Failed/cancelled funding workflows surface in the UI; stale maintenance fails the API health check.
- Service failures remain service failures. Inspect `./scripts/demo logs` and `./scripts/demo status`; there is no fallback that makes a failed search engine look healthy.
- Search, caching, vectors, and workflow execution now compete with transactions for Postgres CPU, memory, I/O, connections, and locks. The cache is **not a blanket Redis replacement**, and this workflow engine is not a replacement for every message broker or cron workload. The remaining warehouse still has replication lag. Keep failures observable and retain a path to split workloads later.

## Changes from the previous checkpoint

- Removed RabbitMQ, the worker and scheduler services/files, their queue volume, AMQP dependency, JavaScript funding assessor, and the application outbox.
- Moved the same deterministic eligibility/risk/grant rules into idempotent SQL activities and a signal-based funding graph. Added a durable maintenance loop; the existing warehouse helper stays in the visible Express API.
- Added the pinned native-extension Docker build. Seed data, search/cache/vector SQL, vector queries, artwork, and frontend dependencies remain unchanged.
- Updated only funding/workflow status, activity ownership labels, health/readiness, tests, and the existing diagram. No new product features or UI framework.

## Not implemented here

Checkpoints 04 through 06, the slide site, Pages publication, recordings, and the plv8/React/HTTP feasibility spike remain outstanding. This image combines pg_durable and pgvector, not the unproven finale extension set. A one-instance React/HTTP finale is still **unverified**.

No fallback recording is claimed to exist. Capture the funding wait with the real instance ID, the SQL before-state, the database restart, the unchanged instance after reconnect, approval, and completed status as one continuous rehearsal recording.
