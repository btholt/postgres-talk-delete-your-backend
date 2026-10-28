# Presenter runbook

For the complete stage guide, use [demo.md](./demo.md): all 31 slides' speaking points and detailed demos are interspersed in order under large **Slide N** and **Demo N.M** headings. It is the single editable source for speaker notes, including the [product-search replacement](./demo.md#gin-demo). This runbook retains implementation status, operational caveats, and verification history.

Open the numbered files in root [sql/](./sql/) and use the PostgreSQL extension's Run button. The guide names every stage file beside its full query; optional speaker view reads the guide's initial slide bullets and includes expandable SQL loaded from those files. Files 09-13 are reused across the same-instance restart, 14 must run as a whole transaction, and the React finale starts at 20 with actual rendering, followed by the 21/22 rename/restore writes. Files 17-19 are rehearsal/debug aids only; 99 is rollback recovery only.

A [public, phone-friendly rendered snapshot](https://gist.github.com/btholt/c1f8479096423cda78907a92381592f0) is available on GitHub Gist. Republish after local guide changes; it is not automatically synchronized.

## Current scope

Checkpoints **00 through 06** are implemented. The finale executes real React SSR inside plv8 and serves HTTP/assets through omni_httpd. The combined native pgvector/pg_durable/pg_duckdb/plv8/omni_httpd image and same-instance durable restart are proven on this ARM64 laptop.

The container inventory is **10 → 8 → 7 → 4 → 3 → 3 → 2**. Checkpoint 06 removes the frontend host but deliberately retains the visible PostgREST process to preserve its generated API/auth/error contract. The literal one-container finale is not claimed. Postgres owns the moved responsibilities; retained external processes remain explicit in every diagram.

### Checkpoint 00 verification completed

- Built and ran natively on this Apple Silicon laptop (`arm64` application images), with all ten containers healthy.
- Passed all four domain tests and the eight end-to-end integration scenarios against the real Compose services.
- Exercised keyword/semantic search, a custom $25.50 backing, human grant approval, analytics, and architecture controls in the browser.
- Checked 390-pixel and 1440-pixel layouts for horizontal overflow, plus dialog dismissal and focus restoration.
- Stopped RabbitMQ and its worker, accepted a funding request into the transactional outbox, and verified processing resumed after restarting them.
- Stopped and started the entire checkpoint without replacing volumes; verified the exact awaiting-approval UUID, an already completed request, and the backing total survived.
- Stopped Meilisearch, confirmed keyword search returned explicit HTTP 503 rather than a hidden fallback, and confirmed recovery after restart.
- Verified the destructive-reset confirmation guard and a fresh seeded startup. Startup uses `--no-build --pull never`; the browser's assets are local. No laptop-wide network settings were changed to test conference Wi-Fi conditions.

The dependency advisory and compressed-request mitigation are documented in the [checkpoint README](./checkpoints/00-original/README.md). This remains a local-only demo, not a production deployment.

## Laptop preparation

### Presentation deck

From `slides/`, run `npm ci` once, then `npm start`. Open **http://127.0.0.1:5173**. See the [presentation guide](./slides/README.md) for authoring and controls.

The [31-slide deck](./slides/deck.md) follows the approved **40-minute talk plus 5-minute buffer**, with Brian's intro, sparse audience copy, brief bullet-point speaker notes, and high-level demo beats in the same notes. The [talk map](./slides/README.md#talk-map) lists chapter timings. The VS Code PostgreSQL extension has a dedicated spotlight and recurring demos; pghacker has a five-minute evidence/critique interlude. DiskANN is a linked footnote only.

In **Live** mode, the checkpoint dropdown switches the real prepared Docker stacks in either direction without changing slides or deleting data. Its status panel reports health, progress, and errors. Architecture slides embed the running application's diagram; the SSR slide opens the real project document. Start on checkpoint **00** and follow transition cues in the notes. Click **Back to slides** after interacting with an iframe to restore keyboard navigation.

For emergency fallback, choose **Images**, press **I**, or use **Use images** in speaker view. The bundled 35 screenshots cover all five app views at checkpoints 00-06. Slides automatically show the matching checkpoint; the image dropdown overrides only the current slide and never controls Docker. Images mode unloads all live demo iframes and does not contact the demo app or controller. Use `?demo=images` to start directly in this mode. Screenshots scroll within the demo area and are explicitly labeled as captures.

Use `npm run build` in `slides/` to generate the standalone static deck. Public builds default to the bundled images, disable local Docker control, and do not load localhost iframes. The [public deck](https://btholt.github.io/postgres-talk-delete-your-backend/) is published by the [Pages workflow](./.github/workflows/pages.yml) after tests and a build on every push to `main`; only static slide assets are deployed. The closing slide links to the [demo repository](https://github.com/btholt/postgres-talk-delete-your-backend). See [Pages setup](./slides/README.md#github-pages) for the one-time repository setting. Rehearsal, verified pghacker citations/responses, and fallback recordings are still outstanding.

### Demo services

1. Start Docker Desktop. Allow approximately 8 GB of memory and ensure ports `3000`, `3001`, and `54320` are free.
2. From the repository root, run `./scripts/demo prepare 00` while online. This pulls all pinned service images and builds the application images.
3. Run `./scripts/demo start 00`. It must finish successfully with all ten services healthy.
4. Visit **http://localhost:3000**. The app has no external fonts, scripts, artwork, inference calls, or payment dependencies.
5. Connect the Microsoft PostgreSQL extension in VS Code to `localhost:54320`, database/user `kickstopper`, password `kickstopper-local`, no SSL.
6. For a clean rehearsal, run `./scripts/demo reset 00 --confirm-delete-demo-data`. This deletes only the five volumes owned by `kickstopper-00-original` and waits for fresh seed/index/snapshot readiness.

## Exact opening actions

| Action | Expected visible outcome |
|---|---|
| Open the home page | Eight illustrated projects. The product is finished, not an extension catalog. |
| Open **Honk** | $18,750 pledged, 124 believers, $25,000 goal on fresh data. |
| **Back this questionable idea**, keep **$25**, then **Pledge $25** | $18,775 pledged and 125 believers. Confirmation says the real wallet is safe. |
| Open **Under the hood** | All eight service boxes plus the modest Postgres node. Queue + worker explicitly says two containers. |
| Select Search, Funding, Analytics, etc. | Scripted request highlights and an honest description of each path, not telemetry. |

Suggested reveal: “That's the application. It's finished. Unfortunately, so is the architecture.”

Do not demonstrate all the features in the opening. Follow the [presenter guide](./demo.md): search on slides 6/8 alongside the GIN query, similarity on 10/11 alongside pgvector, funding on 12-15 alongside the durable restart, and analytics on 16/17 alongside DuckDB. Each chapter first uses the existing implementation, then switches checkpoints and shows the replacement. The opening pledge remains in checkpoint 00; later checkpoints have separate data.

Optional scheduling proof belongs after the durable restart, on slide 15: choose **Make WalkBlock due** on Under the hood and wait for the maintenance tick to change its state to `expired`. Skip it if it distracts from the restart proof.

## Checkpoint 01: search and cache consolidation

```sh
./scripts/demo prepare 01 --local  # Reuse local service images; no registry pulls.
./scripts/demo stop 00
./scripts/demo start 01
```

Use ordinary `prepare 01` on a fresh machine that needs the pinned images downloaded. `--local` still needs network for an uncached application dependency or base image. Package versions are unchanged; only Redis was removed from the backend lockfile.

This is a **prepared checkpoint transition, not a live data migration**. The public ports and credentials are unchanged. Reconnect VS Code and refresh schema exploration because the database volume is now `kickstopper-01-search-and-cache_postgres-data`, not 00's volume.

| Action | Expected visible outcome |
|---|---|
| Search `sourdough` | The same BreadOps and Crumb & Go cards, now sourced from Postgres full-text search + UNLOGGED cache. |
| Inspect `projects.search_document` and its GIN index in VS Code | Search work is now database-owned, maintained automatically on SQL writes. |
| Show the existing UNLOGGED definition, then `SELECT key, value, expires_at FROM public.project_summary_cache;` | A disposable JSONB cache with an expiry. Data changes skip WAL; no refill/hit sequence or expiry wait onstage. |
| Run the real product full-text query and inspect its GIN definition in VS Code | The same rehearsed results now come from Postgres. Similar unloaded responsiveness, one less search-service box; no synthetic benchmark required. |
| Back Honk, request funding, approve, open analytics | Same product behavior, unchanged queue/worker/warehouse. Backing and expiration invalidate the cache within the Postgres transaction. |
| Open Under the hood | Six surrounding responsibilities, eight containers. Search/cache labels inside the larger Postgres node. **SHIP IT. For this workload.** |

The stage demo is product-focused: full-text search backed by GIN provides most of the search capability this product needed. Similar user-visible responsiveness without meaningful load is not measured performance equivalence. Name the lost typo tolerance/implicit prefix matching and show the removed search box.

Optional development material: the earlier plan rehearsal measured approximately **679 ms → 0.02 ms** on 40,008 search-only fixture rows, with the same result IDs 2 and 7 and no forced planner settings. That compares read-time document construction with a stored/indexed document, not GIN alone, and is not part of the stage demo. The real eight-row product table may sensibly use a sequential scan. See the [checkpoint README](./checkpoints/01-search-and-cache/README.md) for those files and tradeoffs.

Explain the cache honestly: it is **UNLOGGED, not crash-safe, not replicated to standbys, and regenerable**. Reads reject expired entries immediately; the existing scheduler removes expired rows every five seconds. Cache refills/invalidation are serialized for this tiny workload; high traffic or specialized search behavior can justify external services again. No cache speed contest or crash demo.

### Checkpoint 01 verification

- Native ARM64 build and eight healthy containers, with no new image versions or runtime packages.
- The copied product-tour tests pass with only keyword/cache expectations changed.
- Postgres-specific tests verify UNLOGGED storage, concurrent refill, TTL, expired-entry rejection, transactional invalidation/rollback, generated-document updates, no-op scheduling, and expired-row cleanup.
- The prepared query-plan test verifies identical results and an actual indexed plan and speed improvement.
- Browser checks confirm the same keyword matches, six surrounding diagram nodes, search/cache labels inside Postgres, and no horizontal overflow at 390 or 1440 pixels. The existing VS Code Kickstopper profile connects and returns the two full-text matches.
- Ordinary 01 stop/start preserves project state and exact funding request IDs. An explicit 01 reset restores seed data while leaving 00's volume intact. Only 01's eight containers run after switching.

## Checkpoint 02: vector consolidation

```sh
# If 01 is already prepared, download only the one new database image.
docker compose -f checkpoints/02-vectors/compose.yaml pull postgres
./scripts/demo prepare 02 --local
./scripts/demo stop 01
./scripts/demo start 02
```

The pinned pgvector 0.8.1 image contains Postgres 17.8 on Debian and publishes native ARM64/AMD64 manifests. Application images were built and the full stack ran natively on this ARM64 laptop. No npm package or lockfile changed. On a fresh machine, `prepare 02` pulls all required images; after preparation, `start 02` never downloads or builds.

This is a **prepared transition, not a live data migration**. Reconnect VS Code at the same `localhost:54320` credentials; the volume is now `kickstopper-02-vectors_postgres-data`. The prior checkpoints' volumes remain separate.

Keep this chapter short:

| Action | Expected visible outcome |
|---|---|
| Find my kind of weird → **Less busywork, fewer meetings** | Stand-in, Reply All, Unsubscribed, BreadOps, in the same order as Qdrant. Source now says Postgres + pgvector. |
| Choose the bread preset, then open BreadOps | BreadOps and Crumb & Go lead; Crumb & Go remains BreadOps's closest related idea. |
| Inspect the `vector` extension and `projects.embedding` in VS Code | pgvector 0.8.1 and native `vector(6)` storage. Run the short [README cosine query](./checkpoints/02-vectors/README.md#working-in-vs-code): ID 7 is first for BreadOps. |
| Open Under the hood → **Similar ideas** | Qdrant is gone. Five surrounding responsibilities, seven containers. `Vectors.` is inside the larger Postgres node. |

Explain `1 - cosine distance`, the same checked-in six-dimensional vectors, and no inference calls. Eight rows need an exact scan, not an ANN index or another benchmark chapter. Larger vector workloads compete with transactions and may justify independent scaling or workload isolation.

### Checkpoint 02 verification

- Seven healthy containers on native ARM64, with pgvector 0.8.1 and Postgres 17.8 confirmed.
- All four preset queries and all eight project-neighbor queries match the captured real Qdrant rankings. Largest observed score difference: approximately `0.0000002`.
- Unit tests and 31 integration checks pass, including the unchanged product tour, cache lifecycle, prior GIN plan spotlight, vector dimensionality, independent cosine calculations, self-exclusion, and invalid inputs.
- The existing VS Code connection returns BreadOps's expected neighbors through pgvector. Browser checks confirm both presets, source labels, five surrounding diagram nodes, and no overflow at 390/1440 pixels.
- Ordinary 02 stop/start preserves projects, exact funding IDs, and similarity results. Explicit reset restores seed data and all 12 rankings while leaving 00/01 volumes intact and their containers stopped. Checkpoint 02 was left with seven healthy containers and fresh data at its completion.

## Checkpoint 03: durable workflows and restart

```sh
./scripts/demo prepare 03 --local
./scripts/demo stop 02
./scripts/demo start 03
```

**Prepare online well before presenting.** There is no upstream ARM64 pg_durable image, so this checkpoint builds v0.2.9 natively from an immutable source commit and verified archive. It retains the pinned Postgres 17.8/pgvector 0.8.1 runtime base, uses pinned Rust 1.94.0/cargo-pgrx 0.16.1, and caches compilation. The current laptop's native image has been built. Ordinary `start 03` does not download or compile.

The four containers are **frontend, Express API, Postgres, ClickHouse**. The worker and scheduler files, AMQP dependency, queue service/volume, and application outbox are gone. The existing Express `syncWarehouse` helper remains an explicit HTTP activity invoked by pg_durable, not a hidden scheduler or polling worker. This activity will remain relevant until the warehouse chapter.

The local demo explicitly enables superuser durable instances and `pg_durable.http_security=unrestricted` for the internal Compose HTTP callback. This permits private-network HTTP; it is development-only, not a production security recommendation. All public ports stay bound to loopback. The callback's activity key is a public demo guard, not real authorization.

### Exact restart actions

1. On fresh data, open **Honk**, choose **Request funding**, and wait for **Needs a human**, risk **32/100**.
2. Capture the displayed **INSTANCE** (eight hex characters) and **REQUEST** (UUID). Do not mistake the application UUID for the pg_durable ID.
3. In the Microsoft PostgreSQL extension, run:

   ```sql
   SELECT id, workflow_instance_id, status, risk_score FROM funding_requests WHERE project_id = 1;
   SELECT id, root_node, created_at, status FROM df.instances
   WHERE id = (SELECT workflow_instance_id FROM funding_requests WHERE project_id = 1);
   SELECT df.status(workflow_instance_id) FROM funding_requests WHERE project_id = 1;
   SELECT request_id, message FROM workflow_events ORDER BY id;
   SELECT pg_postmaster_start_time();
   ```

4. From the repository root:

   ```sh
   docker compose -f checkpoints/03-durable-workflows/compose.yaml restart postgres
   ./scripts/demo status 03
   ```

   This restarts the **same container and persistent volume**, while the API and warehouse remain running. Do not use `reset`, `down --volumes`, or a checkpoint switch.
5. Reconnect VS Code and repeat the same SQL. Postmaster start time changes; durable instance ID, root node, creation time, risk, and completed events do not. The request is still waiting for a human. Allow the durable maintenance timer to resume and health to recover.
6. Approve through the funding desk. The same instance completes with a **$2,500 simulated grant** and one final event. `df.status()` returns `completed`. Repeated approval does not duplicate the grant or timeline.
7. Open **Under the hood**: only three surrounding boxes remain, with `Workflows. Timers.` inside Postgres. Highlight funding and expiration paths; note the retained API warehouse activity. **SHIP IT. For this workload.**

An approval may arrive before the signal subscription is ready. The committed decision is therefore delivered by a small durable handoff that retries with a one-second backoff until the funding row acknowledges it. There is no presenter timing trick and no Node retry worker. SQL steps are guarded against duplicate effects; real external effects would still require idempotency.

Optional scheduling moment: **Make WalkBlock due**. Its status changes only on a pg_durable maintenance tick. The same durable loop owns expired-cache cleanup and schedules the existing warehouse copy. Failed refresh iterations remain in engine history/logs; stale maintenance fails API health.

### Checkpoint 03 verification

- Native ARM64 pg_durable 0.2.9 and pgvector 0.8.1 run together on Postgres 17.8; no emulation.
- Three domain tests and **42 integration checks** pass: full product behavior, moved SQL rules and idempotency, rollback-safe handoff, cancellation handling, cache expiry/cleanup, vector equivalence, the retained GIN spotlight, and the real restart.
- Automated restart testing captures the container/volume, actual instance ID, root node, creation time, and prior events; restarts Postgres; verifies maintenance resumes; and completes the same instance without repeated eligibility/risk events.
- Browser checks show distinct instance/request IDs, successful approval, three surrounding diagram nodes, explicit warehouse-activity ownership, and no horizontal overflow at 390/1440 pixels.
- Warehouse-outage validation returns explicit analytics errors, records failed durable HTTP iterations, and fails stale maintenance health. Restoring ClickHouse lets the **same** maintenance instance recover without another scheduler process or root workflow.
- Full-stack stop/start preserves funding state and the single maintenance instance. An explicit 03 reset restores eight active projects, no funding requests, and one maintenance workflow while preserving all earlier volumes. Checkpoint 03 was left with four healthy containers and fresh data at its completion.

The automated restart test uses **BreadOps** and expects a **$1,800** grant. The manual fresh-data tour above uses Honk and expects **$2,500**. Both use the same deterministic rules.

Fallback recording remains outstanding. Record one continuous sequence: funding wait and actual instance ID, SQL before-state, database restart, reconnect with unchanged instance, approval, and completed `df.status()`. No recording is claimed to exist.

## Checkpoint 04: analytics consolidation

```sh
./scripts/demo prepare 04 --local
./scripts/demo stop 03
./scripts/demo start 04
```

The image keeps Postgres 17.8, pgvector 0.8.1, and pg_durable 0.2.9, and adds native artifacts from the digest-pinned pg_duckdb **v1.1.1** image. Its installed extension schema version is **1.1.0**, as upstream's control file specifies. Native ARM64 operation of all three extensions is verified. The inherited Rust/compiler stages are reusable; no application package or lockfile changed.

The remaining containers are **frontend, Express API, Postgres**. ClickHouse's service/volume/configuration/credentials, snapshot-copy helper, startup setup, internal refresh endpoint/key, and durable HTTP step are gone. Maintenance still owns campaign expiration and expired-cache cleanup. pg_durable HTTP, DuckDB cloud access, and implicit extension downloads are disabled.

Keep this chapter to the same chart, the real plan, and the removed box:

| Action | Expected visible outcome |
|---|---|
| Open Analytics on fresh 04 data | The same $123,820, 874 backers, fourteen daily bars, and four category totals as ClickHouse. Source now says Postgres + pg_duckdb. |
| Execute the whole [05-analytics.sql](./checkpoints/04-analytics/scripts/sql/05-analytics.sql) transaction in the Microsoft PostgreSQL extension | A real `Custom Scan (DuckDBScan)` plan for the existing UTC daily-pledge query. `SET LOCAL` routes only this transaction; commit restores normal execution. |
| Back Honk with $25, then refresh Analytics | $123,845 and 875 backers, without waiting for replication. The browser's normal poll interval remains five seconds. |
| Open Under the hood → Analytics | Only frontend and Express remain outside Postgres. `Analytics.` appears inside the larger database. Three real containers. **SHIP IT. For this workload.** |

The full ClickHouse payload was captured before switching and compared against all three replacement aggregates, including JSON number/string types, every daily row, and category totals. The original chart component remains unchanged. `refreshed_at` now means query time; the API's five-second interval is UI polling, not a warehouse copy schedule.

Observed warm full-dashboard queries on the prepared eight projects/874 backings took approximately **13–14 ms**. Do not sell this as a warehouse benchmark or universal speedup. Analytics now shares database CPU, memory, I/O, and connections with transactions. DuckDB is budgeted at 256 MB and two threads **per connection**; that is not a whole-server RSS cap. Separating large/concurrent analytics remains a legitimate design.

### Checkpoint 04 verification

- Three domain tests and **49 integration checks** pass, including the retained same-instance approval/restart demo with all three extensions loaded.
- Every production analytics query has an actual `DuckDBScan`, not a success-shaped Postgres fallback.
- Complete results match both the live ClickHouse baseline and an independent calculation over raw data. UTC date behavior remains correct in a non-UTC session.
- A failed analytics query rolls back and returns the **same** pooled connection without leaking DuckDB routing or read-only state.
- The production queries also run in an isolated container with networking disabled. There is no MotherDuck token, remote file, or runtime extension download.
- Browser validation preserves four metrics, fourteen bars, four category breakdowns, manual refresh, and 390/1440-pixel layouts; the diagram contains only two surrounding nodes.
- Full-stack stop/start preserves analytics values, funding IDs, and the single maintenance instance. Explicit 04 reset restores the complete captured ClickHouse data shape with eight active projects and no funding requests, while preserving all earlier databases and 03's warehouse volume. Checkpoint 04 is left running with three healthy containers and fresh data.

An analytics fallback recording remains outstanding. Capture the old chart, the prepared checkpoint switch, the same chart/source after switching, the actual DuckDB plan, a new backing reflected on refresh, and the updated three-container diagram. No recording is claimed to exist.

## Checkpoint 05: generated API, not vanished HTTP

```sh
./scripts/demo prepare 05 --local
./scripts/demo stop 04
./scripts/demo start 05
```

The runtime is **frontend, PostgREST, Postgres**. The entire `backend/` runtime directory and Express dependencies are gone. Node exists only for frontend builds and the separate development-only `tests/` driver. The PostgREST binary is pinned to native v16.5 and runs non-root; admin readiness and the generated business-health RPC are both probed.

Refresh the browser and reconnect VS Code after the prepared checkpoint switch. Ports/administrative credentials remain unchanged; the volume is now `kickstopper-05-generated-api_postgres-data`. This is not a migration.

### Exact actions

| Action | Expected outcome |
|---|---|
| Browse, keyword search, and semantic presets | Same screens, cards, cache, FTS and vector ordering through generated resources/scoped RPCs. |
| Open **API docs** in the checkpoint-05 presentation toolbar | Locally bundled Swagger UI rendering the real PostgREST OpenAPI description, without another container. |
| GET `/projects` -> Try it out: `id=eq.1`, `select=id,name` -> Execute | HTTP 200 and Honk from the actual generated resource. Anonymous GET-only demo; writes are disabled in this explorer. |
| Back Honk with $25 and request funding | SQL checks amount, identity and idempotency, then submits the same durable workflow. |
| Inspect `api.funding`, `api.events`, role grants and RLS in VS Code | The HTTP login is not a superuser; private rows are scoped by the signed demo subject. |
| Approve and open analytics | Same fake grant/event trail/chart. DuckDB's unsafe function-execution mode remains off. |
| Show the absent `backend/` and Compose list | Frontend, PostgREST, Postgres. Three containers, not two. |
| Under the hood → Funding | PostgREST stays visibly outside the expanded database. API rules/RLS are inside. |

Suggested line: “We deleted our application server code. We still have an HTTP process. Please remember that.”

Swagger UI is at `http://127.0.0.1:5173/api-docs.html?checkpoint=05&source=live`; checkpoint 06 uses the same page with `checkpoint=06`. The page verifies checkpoint identity and calls the real `/api/` path. In Images mode/public builds, captured schemas are labeled and execution is disabled. Documented endpoints alone are not authorization proof.

The UI deliberately retains the shared founder experience with a public, non-expiring local-demo JWT. Its signing key is a disposable public server-side example; neither database credentials nor a signing key are in the frontend bundle. This is not production authentication or a real-world self-approval policy.

`api_authenticator` can impersonate only `web_anon`/`web_user`, not `api_owner`, `analytics_executor`, or the administrator. RLS protects funding/events; raw backings are not published, and their command checks receipt ownership. Privileged commands use fixed search paths and narrow grants. Actual durable activities are submitted as non-superuser `api_owner`; superuser instance creation is disabled.

### Analytics boundary, honestly

PostgREST's PostgreSQL JSON wrapper cannot be executed as DuckDB SQL: the naive view solution silently fell back to PostgreSQL. The fixed analytics RPC therefore uses built-in dblink to issue only the three known read-only aggregate queries on another backend connection to **this same instance**, as a restricted analytics role. It preserves one repeatable-read snapshot and closes the connection on success/error. There is no external analytics server, HTTP shim, or unsafe-mode exception.

The outer HTTP JSON plan is **not** claimed to be DuckDB. Tests inspect the actual inner queries and verify `DuckDBScan` under the exact analytics login settings. This costs a database connection per dashboard request, so connection budgets remain an operational tradeoff.

### Checkpoint 05 verification

- Generated OpenAPI/resources and actual RPC status codes work without an Express process.
- Concurrent/idempotent backing, strict amount validation, funding eligibility/risk/grant limits, rejection, ineligibility, expiration and cache cleanup pass.
- All four preset and eight project-neighbor rankings are preserved. The chart and frontend dependency lockfile are unchanged.
- Direct HTTP tests reject invalid/expired JWTs, forged privileged roles, raw writes, private-schema selection, cross-owner funding/events/decisions and foreign idempotency receipts.
- Real DuckDB aggregation remains active with unsafe function mode disabled. The same-instance/container/volume restart still completes approval with no repeated events.
- Browser validation covers custom backing, request/instance IDs, approval, analytics, a visible PostgREST node and 390/1440-pixel layouts.
- Full stop/start preserves project, backing, funding, analytics and the one durable maintenance instance without an application startup process. Explicit 05 reset restores eight active projects, no funding requests and one `api_owner` maintenance instance while preserving all earlier volumes.

No fallback recording is claimed to exist. Capture the old server directory, the prepared switch, generated OpenAPI/resource reads, the same product tour, permission/policy inspection, and the still-visible HTTP process.

## Checkpoint 06: React inside Postgres

```sh
./scripts/demo prepare 06 --local
./scripts/demo stop 05
./scripts/demo start 06
```

The runtime is **Postgres + PostgREST**, two containers. The frontend source is still needed at build time, but its Nginx configuration, Dockerfile, and running host are gone. There is no runtime Node process. Postgres owns the public React render, HTML shell, built assets, and HTTP listener.

Refresh/reconnect VS Code after the prepared switch. The database is `kickstopper-06-react-in-postgres_postgres-data`; the ports and disposable administrative credentials are unchanged.

| Action | Expected visible outcome |
|---|---|
| In VS Code, run `SELECT render_page(1);` | A complete HTML document containing the real Honk product markup, generated by React in plv8. |
| Open **http://localhost:3000/project/1** | Honk, the same illustrated page, initially rendered by the database and hydrated in the browser. |
| Run `UPDATE projects SET name='Honk: now rendered in Postgres' WHERE id=1;` | A normal transactional SQL change, with summary-cache invalidation. |
| Refresh the page | The new name appears in the server HTML and the hydrated page, without rebuilding an image or editing an HTML template. |
| Inspect `curl -s http://localhost:3000/project/1` | Actual product markup and safely escaped bootstrap JSON, not an empty client-rendered shell. |
| Run `UPDATE projects SET name='Honk' WHERE id=1;` | Restore the prepared product name. |
| Repeat search, similarity, backing, funding approval, analytics | The same rules, data contract, RLS, durable workflow, and DuckDB queries remain in place. |
| Open Under the hood | A giant Postgres rectangle containing “React, somehow.” A visible **PostgREST*** box remains. Verdict: **PLEASE DO NOT. But it renders.** |

Public project links perform real document navigation to `/project/:id`. Funding, analytics, and the diagram retain their existing hash routing and browser requests. HTTP cannot receive a URL fragment; private records are not included in public SSR.

Explain the asterisk explicitly: omni_httpd handles page/static HTTP and proxies only `/api/` to a fixed PostgREST target. OmniREST's inspected compatibility layer is not a drop-in replacement for the verified JWT/role/error contract. We retained the proven API rather than writing another authentication gateway. Browser JavaScript still runs in the browser.

The synchronous React 19 legacy browser renderer is bundled without Node or streaming APIs. The pinned plv8 build has no Intl; only the app's fixed en-US integer-count/USD-cent formatting needs a small tested accommodation. Renderer code is cached per backend/role; data is read fresh and passed locally to each render. Only the empty shell/assets are stored, not prerendered product pages.

The native donors target PG17.6 while the prepared runtime is PG17.8. Omnigres logs that minor-version warning and can emit a parallel-worker configuration warning. Tests cover this exact combination; neither a warning-free upstream release nor general extension/managed-service compatibility is claimed. The donor also lacks plv8's optional execution-timeout GUC. This remains trusted demo code, not an arbitrary JavaScript execution service.

### Checkpoint 06 verification

- The preserved API/SQL-rule suite, actual DuckDB plans, owner isolation, status/header forwarding, and same-volume workflow restart pass through omni_httpd.
- Additional tests cover real read-only plv8 execution, constrained renderer ownership, live SQL changes, script/HTML escaping, no-Intl formatting boundaries, exact asset bytes, missing routes, request-data isolation, and the two-service/port inventory.
- Browser checks cover public-page hydration without errors, product interactions, and 390/1440-pixel layouts.
- Ordinary offline-prepared stop/start retains data, assets, and workflow instances. Explicit reset is scoped to the 06 volume and restores fresh seed data without touching earlier checkpoints.

For fallback capture, record the SQL render, live SQL edit and browser refresh, product interaction, same-instance restart, and honest two-container diagram. No recording is claimed to exist.

## Recovery and stopping

```sh
./scripts/demo status 00
./scripts/demo logs 00
./scripts/demo stop 00
./scripts/demo start 00
```

Ordinary stop/start preserves data. If the opening tour has already been performed, reset explicitly before presenting again. Do not “fix” rehearsal data with an invisible automatic reset.

Use `01` instead of `00` for the active search/cache checkpoint. Its reset deletes only its four named volumes; it never resets checkpoint 00. Stop the active checkpoint before switching.

Use `02` for the vector checkpoint. Its explicit reset deletes only its three named volumes, never 00's or 01's.

Use `03` for durable workflows. Its explicit reset deletes only its two named volumes. Ordinary stop/start preserves funding and maintenance instance IDs. Reset clears them and is not the durability demonstration.

Use `04` for analytics. Its explicit reset deletes only its one named database volume, never any earlier checkpoint's data.

Use `05` for the generated API. Its explicit reset deletes only its one named volume. Database initialization registers maintenance once; ordinary stop/start preserves the same workflow instances.

Use `06` for the finale. Its reset deletes only its one named database volume. HTML assets and renderer code are installed from the prepared image at initialization. Rebuilding an image alone does not update those rows in an existing volume; use the explicit 06 reset after source/build changes.

If VS Code reports `connection refused` on `localhost:54320`, start whichever checkpoint is active (`00` through `06`) and wait for healthy status. All services use `restart: unless-stopped`; explicitly stopped containers still require a start. In the extension's connection-string form, use `postgresql://kickstopper@localhost:54320/kickstopper?sslmode=disable` and enter `kickstopper-local` in the separate password field.

The funding desk is a shared local demo-founder view, not real authorization. Keep host bindings on loopback and do not deploy it publicly.

## Verification commands

```sh
cd checkpoints/00-original/backend
npm ci
npm run check
npm test
npm run test:integration
cd ../frontend
npm ci
npm run build
```

Integration tests require the running stack and **fresh seed data**; they intentionally exercise backing, approvals, rejection, ineligibility, expiration, and analytics. Reset after them for the presentation.

For checkpoint 01, use `checkpoints/01-search-and-cache/backend` and the corresponding frontend directory. In addition to the same commands, run `npm run test:postgres` and `npm run test:search-plan`. The latter creates only the named `search_demo.projects` rehearsal fixture.

For checkpoint 02, use `checkpoints/02-vectors/backend` and its frontend directory. Keep the same commands and add `node --test test/vectors.js`. The permanent vector tests contain the original Qdrant ranking expectations; no earlier checkpoint is required to run them.

For checkpoint 03, use its backend/frontend directories and the same tests, plus:

```sh
node --test test/workflows.js
node --test test/durable-restart.js
```

The restart test requires Docker and fresh demo data; it restarts only this checkpoint's Postgres container. Reset explicitly afterward for rehearsal.

For checkpoint 04, use its backend/frontend directories and the same commands, plus `node --test test/analytics.js`. The physical-plan tests use the exact query strings from the API integration module. The full analytics payload can be checked without running an earlier checkpoint.

Checkpoint 05 has no backend runtime. From `checkpoints/05-generated-api/tests`, run `npm ci` and `npm test` against a fresh running 05. The driver exercises both the browser adapter and direct PostgREST URLs. It restarts only this checkpoint's database for the real continuity proof.

For checkpoint 06, use `checkpoints/06-react-in-postgres/tests` with the same commands. All generated API tests now run through native Postgres HTTP, and `react-ssr.js` adds the finale assertions. Reset explicitly afterward for presentation data.

## Outstanding presentation work

- Implement the standalone slide site with reverseable reveals, stable URLs, speaker notes, and diagrams that match the runnable inventory.
- Prepare the cited pghacker interlude, with its explicit connectivity exception and recorded fallback.
- Rehearse timing and capture real fallback recordings. No recording is claimed to exist.

The prepared finale proves this pinned local combination, not arbitrary future versions or managed-service availability.
