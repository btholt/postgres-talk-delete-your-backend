# Delete Your Backend: Presenter Guide

[Phone-friendly rendered copy](https://gist.github.com/btholt/c1f8479096423cda78907a92381592f0). This public Gist is a published snapshot; local edits are not automatically synchronized.

One scrolling source for the whole talk: each **Slide** heading contains the brief speaking points, followed immediately by any **Demo N.M** instructions for that slide. Demo numbers use the slide number, not the Docker checkpoint. Every SQL query retains its numbered file and full text. Nothing runs automatically.

The opening establishes browsing and backing only. Search, similarity, funding, and analytics are demonstrated inside their own chapters: use the feature on the current checkpoint, switch to its replacement, then show the matching app, SQL, and architecture. Do not run a separate all-features product tour first.

Edit speaker-note bullets here, not in the slide deck. The presentation reads the initial bullet list after each `## Slide N:` heading; detailed demos and resource lists stay in this guide. Audience slide content remains in `slides/deck.md`.

## Before the Talk

- Prepare all checkpoints while online. Do not build images or install packages onstage.
- Start the presentation with `cd slides && npm start`, then open <http://127.0.0.1:5173/>.
- Choose **Live** before using the presentation's checkpoint dropdown. In **Images** mode, that dropdown changes pictures, not Docker.
- Start on checkpoint **00**. For a terminal transition, stop the current checkpoint before starting the next:

  ```sh
  # Example: 00 is currently running.
  ./scripts/demo stop 00
  ./scripts/demo start 01
  ./scripts/demo status 01
  ```

- After each transition, reconnect the **same saved VS Code connection**, reconnect the SQL editor if necessary, and refresh the schema explorer. Checkpoints have separate databases behind the same address:

  ```text
  postgresql://kickstopper@localhost:54320/kickstopper?sslmode=disable
  ```

  Password: `kickstopper-local`. This is a disposable local-demo credential.

- Use the app's checkpoint badge to confirm the implementation. The connection name/database name alone cannot distinguish checkpoints.
- The expected dollar totals below assume fresh seed data. Rehearsals persist. Do not assume a restart resets anything.
- For a repeatable opening and funding demo, inspect/reset the relevant checkpoint **before presenting**, with other checkpoints stopped. For example, with 03 active:

  ```sh
  # Destructive: deletes only checkpoint 03's demo volumes and starts it fresh.
  ./scripts/demo reset 03 --confirm-delete-demo-data
  ```

  Never use reset as the durable restart demonstration. The search demo uses the real product table; no larger fixture preparation is needed.

### pghacker preparation

- Add the remote Streamable HTTP MCP server <https://pghacker-mcp.dev/mcp> to the agent used in VS Code. The [public site](https://pghacker-mcp.dev/) provides connection information; it needs no sign-in.
- Confirm tools are available and rehearse the prompts below.
- Save a useful response and its original citation, and capture a recording/transcript fallback. **These captures and a verified historical answer are not supplied by this repository yet.**
- This is an online research segment, unlike the prepared local app.

## Run the Numbered SQL Files

Every query below has a ready-to-run file in the root [sql/](./sql/) directory. Open the named file in VS Code, connect it to the saved Postgres profile, clear any text selection, and use the extension's **Run** button to execute the whole file. No query typing or copy/paste is needed.

| Checkpoint | Files in presentation order |
|---|---|
| 01 | `01`-`03`: search; `04`-`05`: quick UNLOGGED/cache look |
| 02 | `06`-`08`: pgvector and similar projects |
| 03 | `09`-`13`: request, instance, status, events, database start time; reuse before/after restart |
| 04 | `14`: DuckDB plan; run the whole transaction as one file |
| 05 | `15`-`16`: roles and owner policies |
| 06 | `20`: execute React and show rendered HTML; `21`-`22`: rename and restore |
| Any | `99`: rollback recovery only, not a normal demo step |

Each file's header identifies its checkpoint and whether it writes data. Only `21` and `22` perform product writes; they change/restore Honk's name and return the affected row. Files `17`-`19` remain rehearsal/debug aids only, outside the live flow and speaker-view query list. Do not select all files and run them together across checkpoints.

Optional speaker view reads its brief bullets from the Slide sections in this guide. Full SQL remains expandable there, loaded directly from the numbered files. You can present entirely from this scrolling guide.

## Slide 1: Delete Your Backend

- How much architecture does this product actually need?
- Fewer services, not fewer responsibilities.
- Share the talk link: https://holt.fyi/dyb.
- Before presenting: checkpoint 00 ready.

## Slide 2: Brian Holt

- Seattle; Principal PM at Microsoft on Postgres DevX and AI.
- Background: Stripe, Netflix, Neon/Databricks, Snowflake, Reddit.
- Would rather be snowboarding; sports fan; minor investor in Cagliari Calcio.
- Disclose Microsoft affiliation and involvement with the VS Code PostgreSQL extension.

## Slide 3: Big Ideas. Questionable Judgment.

- A finished crowdfunding product, not an extension catalog.
- **Demo | App, checkpoint 00:**
  - Browse projects and open Honk.
  - Back Honk with fake money.
- Save search, similarity, funding, and analytics for their matching chapters.
- Keep the implementation reveal for the next slide.

## Demo 3.1: Browse and Back a Project

1. Browse the project cards. Establish that this is a finished crowdfunding product.
2. Open **Honk**. On fresh data: **$18,750**, **124 believers**, **$25,000 goal**.
3. Choose **Back this questionable idea**, keep **$25**, and pledge. Expect **$18,775** and **125 believers**. This is a write; money is simulated.

Stop here and reveal the architecture. The other features get their first walkthrough alongside the slides and SQL that replace their supporting services.

## Slide 4: Unfortunately, So Is the Architecture.

- **Show | App architecture, checkpoint 00:** ten real containers.
- Frontend, API, cache, search, vectors, warehouse, scheduler, queue + worker, Postgres.
- Trace one request; highlights are scripted explanations, not live telemetry.
- Queue + worker count as two containers; no hidden processes.

## Demo 4.1: Architecture Reveal

Open **Under the hood** in checkpoint **00**. Show the service inventory and trace **Search** or **Funding**.

**Point at:** the finished features first, then the ten-container architecture. Queue + worker are explicitly two containers. The path highlights are scripted explanations, not live telemetry.

## Slide 5: Same Product. Less Plumbing.

- Responsibilities move; they do not vanish.
- Prepared checkpoints, separate persistent data; not a live migration.
- Container count is a visual aid, not a measure of total software or complexity.

## Slide 6: Search Is Data, Too.

- **Demo | App, checkpoint 00:** search sourdough; show BreadOps, Crumb & Go, and the Meilisearch + Redis source.
- Built-in full-text search: stored search document + GIN index.
- Disposable project summaries: UNLOGGED cache table.
- Full-text search backed by GIN supplies most of the search capability this product needed.
- A fit for this workload, not universal search or Redis replacement.
- **Transition | Checkpoint 01:** only after the app search; reconnect VS Code for slides 7-9.

## Demo 6.1: Search Before the Replacement

Stay on **checkpoint 00** from the opening. In the embedded app, search `sourdough`. Expect **BreadOps** and **Crumb & Go**; point at the **Meilisearch + Redis** source.

This is the first search walkthrough, immediately before its replacement, not a callback to an opening search demo. Keep the two results in mind while explaining the stored search document and GIN.

After showing the results, switch **00 -> 01**. Reconnect VS Code and refresh schema exploration on slide 7. Slide 8 repeats this exact app search beside the real full-text query and GIN definition.

## Slide 7: Postgres. Meet Your Editor

- **Show | VS Code:** connection, schema explorer, SQL editor, and real product search results.
- This is the working environment for the remaining database demos.
- Works with the local demo; no Azure deployment required.
- Skip installation and setup; disclose Microsoft involvement, not a blanket open-source claim.

## Demo 7.1: VS Code Demo

With checkpoint **01** active, reconnect the same saved connection and refresh schema exploration.

1. Show the connected PostgreSQL extension and `public.projects` in the schema explorer.
2. Show the SQL editor, its selected connection, and the Run control.
3. Keep the editor ready for the numbered queries on the next slide.

No installation, new connection profile, or Azure deployment. The next slide shows the real product queries; this is just the workbench introduction.

## Slide 8: Same Search. One Less Service.

- **Demo | VS Code + app, checkpoint 01:**
  - Search sourdough in the embedded app; compare the matches with slide 6.
  - Inspect the search column and GIN index in VS Code.
  - Run the real product full-text search in VS Code; show the same two matches.
- Basically the same user-visible responsiveness here, obviously without meaningful load; not a measured performance-equivalence claim.
- Full-text search backed by GIN gives us most of the search capability this product needed.
- One less search-service box; no synthetic benchmark or required indexed plan for eight rows.
- Tradeoffs: no Meilisearch typo tolerance or implicit prefix matching.

## Demo 8.1: Product Search in the App

<a id="gin-demo"></a>

**Checkpoint 01.** Show the same feature, not a GIN performance benchmark.

- Postgres can own this app's keyword search without a separate search service.
- A `tsvector` is a searchable document of normalized words. It is not a pgvector embedding.
- A GIN index is an inverted lookup: roughly, "which rows contain this word?" rather than "inspect every row."
- Full-text search plus GIN supplies most of the search capability this product needed; a dedicated engine may still offer features this replacement does not.

Checkpoint **01** should already be active from the transition after Demo 6.1, with VS Code reconnected on slide 7. Confirm the app's checkpoint badge before continuing.

On this slide's embedded app, search `sourdough`. Show the same **BreadOps** and **Crumb & Go** from slide 6, now sourced from Postgres full-text search + UNLOGGED cache. Go directly to the VS Code queries below without advancing the slide.

**Point at:** the same useful results and similarly immediate response in this tiny demo. Do not compare stopwatch timings or claim equivalent performance under load.

## Demo 8.2: Product Search in VS Code

Expand `public.projects`. Show `search_document` and `projects_search_document_idx`. They already exist in checkpoint 01; do not build an index onstage.

**Run [sql/01-select-search-documents.sql](./sql/01-select-search-documents.sql).**

```sql
SELECT id, name, search_document
FROM public.projects
WHERE id IN (2, 7)
ORDER BY id;
```

**Point at:** the stored normalized words. This is full-text search data, not a semantic embedding.

Run the app's search predicate and ranking, with names included to make the result readable:

**Run [sql/02-search-projects.sql](./sql/02-search-projects.sql).**

```sql
SELECT id, name
FROM public.projects
WHERE search_document @@ websearch_to_tsquery('english', 'sourdough')
ORDER BY ts_rank(search_document, websearch_to_tsquery('english', 'sourdough')) DESC, id
LIMIT 50;
```

**Expect these two matches** (ranking may determine their display order):

| id | name |
|---|---|
| 2 | BreadOps |
| 7 | Crumb & Go |

Then show the index definition:

**Run [sql/03-show-search-index.sql](./sql/03-show-search-index.sql).**

```sql
SELECT indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'projects_search_document_idx';
```

**Point at `USING gin (search_document)`.** GIN provides the inverted-index machinery for full-text search as the data grows. It is not Meilisearch running inside Postgres.

The [actual search implementation](./checkpoints/01-search-and-cache/backend/src/integrations.js) uses this predicate, orders by full-text rank and ID, and limits the results. If you open that source, show `searchProjects`, not the whole integration module.

### Talking points

- "Basically the same responsiveness here, while obviously not under any sort of load, but one less search box in our diagram."
- "Postgres full-text search, backed by GIN, gets us most of the search capability this product needed."
- "That is not a claim that GIN replaces every search engine feature or that these systems perform the same under load."

Be explicit about the tradeoff: English stemming and web-search operators work, but Meilisearch's typo tolerance and implicit prefix matching are not reproduced. These rehearsed matches are equivalent; every possible search is not.

No `EXPLAIN` comparison, forced index plan, or synthetic dataset is required. With eight product rows, Postgres may sensibly choose a table scan. Do not describe the current read as using GIN unless you actually inspected its plan. The larger fixture and prepared plan scripts remain available as optional development material in the [checkpoint README](./checkpoints/01-search-and-cache/README.md#query-plan-spotlight), not part of this stage demo.

## Slide 9: Two Boxes Down.

- **Show | VS Code:** existing UNLOGGED definition, then the cache row's key, JSONB value, and expiry.
- This is our cache now; its data changes skip WAL. The expiry is application logic, not built into UNLOGGED.
- Disposable copy: not crash-safe or replicated to standbys; durable project records remain the source of truth.
- No refill/hit sequence, expiry wait, or crash demonstration; move straight to the diagram.
- **Show | Architecture, checkpoint 01:** search and cache inside Postgres.
- Search removes one box; replacing Redis removes another. Ten containers become eight overall.

## Demo 9.1: Quick UNLOGGED Cache Look

**Show in VS Code, then return to the diagram on slide 9.** The definition is included as comments in this file, so clicking Run cannot accidentally recreate the table.

**Run [sql/04-show-cache-definition.sql](./sql/04-show-cache-definition.sql).**

```sql
-- CREATE UNLOGGED TABLE project_summary_cache (
--   key text PRIMARY KEY,
--   value jsonb NOT NULL,
--   expires_at timestamptz NOT NULL
-- );
SELECT relname AS table_name,
  CASE relpersistence WHEN 'u' THEN 'UNLOGGED' ELSE 'LOGGED' END AS storage
FROM pg_class
WHERE oid = 'public.project_summary_cache'::regclass;
```

Point at the commented definition; the result confirms `project_summary_cache` is `UNLOGGED`. No catalog tour needed.

Then show the cached data and its expiry:

**Run [sql/05-select-cache.sql](./sql/05-select-cache.sql).**

```sql
SELECT key, value, expires_at
FROM public.project_summary_cache;
```

**Point at:** `projects:summary:v1`, a JSONB array of project summaries, and `expires_at`. If the row has already expired and been cleaned up, refresh Discover in the app and rerun the query.

**Talking points:**

- "This is our cache now: an UNLOGGED table holding some JSON and an expiry."
- "Changes to this table's data don't produce WAL. We can lose this copy and rebuild it from the real project records."
- "The expiry is our application logic, not something UNLOGGED automatically does."
- Brief caveat: cache contents are not crash-safe or replicated to standbys; the actual project records remain durable.

No cache clearing, refill/hit sequence, expiry wait, catalog comparison, or crash demonstration.

## Demo 9.2: Architecture Reveal

Return to **Under the hood**, checkpoint **01**. One less box for the search service, then another for Redis: **10 -> 8 containers** overall.

Reference: [PostgreSQL 17: UNLOGGED tables](https://www.postgresql.org/docs/17/sql-createtable.html#SQL-CREATETABLE-UNLOGGED).

## Slide 10: Similarity Is Data, Too.

- **Demo | App, checkpoint 01:** choose Less busywork, fewer meetings; show Stand-in, Reply All, and the Qdrant source.
- Vectors encode similarity; cosine distance ranks nearby ideas.
- The same prepared six-dimensional vectors, now stored beside the projects.
- **Transition | Checkpoint 02:** after the Qdrant results, move to pgvector for slide 11.
- Eight projects need exact search, not an ANN benchmark.
- DiskANN stays a footnote only; no new extension or demo.

## Demo 10.1: Similarity Before the Replacement

Stay on **checkpoint 01** from the search/cache chapter. Clear keyword search, open **Find my kind of weird**, and choose **Less busywork, fewer meetings**. Expect **Stand-in** first, followed by **Reply All**. Point at **Qdrant** as the source.

Open **BreadOps** and show its related ideas, with **Crumb & Go** first. These are the two similarity paths to compare with the prepared vectors and SQL on the next slide; no live inference call is involved.

Only after showing these results, switch **01 -> 02**, reconnect VS Code, and advance to slide 11.

## Slide 11: Same Weird. One Fewer Database.

- **Demo | App + VS Code, checkpoint 02:**
  - Show the same prepared similarity results.
  - In VS Code, inspect the vector column and a short cosine-similarity query.
  - Show the architecture: Qdrant gone, vectors inside Postgres, seven containers.
- No live embedding service or index-speed contest.
- Larger vector workloads still compete with transactional resources.

## Demo 11.1: pgvector in the App and VS Code

1. Confirm **checkpoint 02**. Clear keyword search, open **Find my kind of weird**, and choose **Less busywork, fewer meetings**. Show the same Stand-in, then Reply All from slide 10, now sourced from pgvector.
2. In VS Code, inspect the extension and stored vectors:

   **Run [sql/06-show-vector-extension.sql](./sql/06-show-vector-extension.sql).**

   ```sql
   SELECT extname, extversion
   FROM pg_extension
   WHERE extname = 'vector';
   ```

   **Run [sql/07-select-embeddings.sql](./sql/07-select-embeddings.sql).**

   ```sql
   SELECT id, name, embedding
   FROM public.projects
   ORDER BY id;
   ```

3. Run the actual neighbor query for BreadOps, ID 2:

   **Run [sql/08-find-similar-projects.sql](./sql/08-find-similar-projects.sql).**

   ```sql
   SELECT id, name,
     1 - (embedding <=> (SELECT embedding FROM public.projects WHERE id = 2)) AS similarity
   FROM public.projects
   WHERE id <> 2
   ORDER BY embedding <=> (SELECT embedding FROM public.projects WHERE id = 2), id
   LIMIT 4;
   ```

4. **Expect Crumb & Go, ID 7, first.** `<=>` is cosine distance; `1 - distance` is the displayed similarity.
5. Open BreadOps's related ideas in the app, then the architecture. Qdrant is gone; **8 -> 7 containers**.

The vectors are prepared `vector(6)` values. No inference API, ANN index build, or DiskANN demo. DiskANN remains a slide footnote.

## Slide 12: The Work. And All Its Plumbing.

- **Demo | App, checkpoint 02:** request Honk funding, show the human wait, then approve the simulated grant.
- Funding needs business state, retries, waiting, and a recorded decision.
- Distinguish the business process from message transport and worker orchestration.
- This app's queue, worker, and scheduler are candidates, not every broker workload.
- **Transition | Checkpoint 03:** after the original funding flow, switch for the durable preflight and restart proof.

## Demo 12.1: Funding Before the Replacement

Stay on **checkpoint 02** from the vector chapter. Open **Honk -> Request funding**. On fresh data, expect **Needs a human** and risk **32/100**. Choose **Approve fake grant**; show the completed **$2,500** grant and event trail.

Explain the queue, worker, and scheduler while this original funding experience is on screen. If this checkpoint's Honk request already completed during rehearsal, show its existing receipt honestly rather than pretending to start a new wait.

Then switch **02 -> 03** and reconnect VS Code. This is separate prepared data: approving the checkpoint-02 request does not approve checkpoint 03's instance. Do the next slide's preflight before starting the durable restart proof.

## Slide 13: Waiting Is Part of the Work.

- Durable steps and waits preserve workflow progress.
- Human approval is a durable wait, not a long-running HTTP request.
- The instance ID identifies the engine's workflow; the request UUID identifies application intent.
- Set up the proof: same database, same volume, same workflow instance.

## Demo 13.1: Funding Preflight

**Checkpoint 03.** Check this before beginning the restart proof.

On fresh 03 data, this query should return no Honk funding request:

**Run [sql/09-select-funding-request.sql](./sql/09-select-funding-request.sql).** Reuse this same file once a request exists.

```sql
SELECT id AS request_uuid, workflow_instance_id, status, risk_score, grant_cents
FROM public.funding_requests
WHERE project_id = 1;
```

There is one funding request per project. If Honk already completed in rehearsal, do not pretend its completed instance is a new wait. Reset 03 explicitly before the talk, or rehearse with another eligible project and adjust the expected grant/risk.

## Slide 14: Let's Restart the Database.

- **Demo | App + VS Code, checkpoint 03:**
  - Start funding; show the human-approval wait and actual durable instance ID.
  - In VS Code, inspect the instance, completed work, and waiting status.
  - Run sql/09 through 13 before/after restart; repeat 09 and 11 after approval. Full SQL follows in this guide.
  - Restart this same Postgres instance; preserve its volume.
  - Reconnect in VS Code; compare the unchanged instance and recorded progress.
  - Approve in the app; show that same instance completing once.
- Not a reset or checkpoint switch; database downtime still interrupts the app.

## Demo 14.1: Start Funding and Inspect Its State

**Checkpoint 03.**

1. In the app, open **Honk -> Request funding**. Wait for **Needs a human**, risk **32/100**.
2. Point at both identifiers: **REQUEST** is a UUID; **INSTANCE** is the real eight-character pg_durable ID.
3. Run these queries in VS Code and keep their results visible:

   **Run [sql/09-select-funding-request.sql](./sql/09-select-funding-request.sql).**

   ```sql
   SELECT id AS request_uuid, workflow_instance_id, status, risk_score, grant_cents
   FROM public.funding_requests
   WHERE project_id = 1;
   ```

   **Run [sql/10-select-durable-instance.sql](./sql/10-select-durable-instance.sql).**

   ```sql
   SELECT id, root_node, created_at, status
   FROM df.instances
   WHERE id = (
     SELECT workflow_instance_id FROM public.funding_requests WHERE project_id = 1
   );
   ```

   **Run [sql/11-select-workflow-status.sql](./sql/11-select-workflow-status.sql).**

   ```sql
   SELECT df.status(workflow_instance_id) AS engine_status
   FROM public.funding_requests
   WHERE project_id = 1;
   ```

   **Run [sql/12-select-workflow-events.sql](./sql/12-select-workflow-events.sql).**

   ```sql
   SELECT id, request_id, message, created_at
   FROM public.workflow_events
   WHERE request_id = (
     SELECT id FROM public.funding_requests WHERE project_id = 1
   )
   ORDER BY id;
   ```

   **Run [sql/13-select-database-start-time.sql](./sql/13-select-database-start-time.sql).**

   ```sql
   SELECT pg_postmaster_start_time() AS database_started_at;
   ```

   **Expect:** application status `awaiting_approval`; engine status `running` while waiting; an instance/root/creation time and recorded completed steps.

## Demo 14.2: Restart the Same Database

1. From the repository root, restart **only this same Postgres container**:

```sh
   docker compose -f checkpoints/03-durable-workflows/compose.yaml restart postgres
   ./scripts/demo status 03
   ```

2. Wait for health, reconnect the same VS Code profile, and rerun files **09 through 13**, unchanged.

   **Point at:** the changed Postgres start time, but unchanged request ID, durable instance ID, root node, creation time, and prior events. The app is still waiting for the same human decision.

**Do not use the checkpoint dropdown, reset, or volume deletion for this restart.** Those would not prove same-instance continuity. Durable progress also does not make arbitrary external effects exactly-once.

## Demo 14.3: Approve the Same Instance

1. In the app, choose **Approve fake grant**. Rerun **09-select-funding-request.sql** and **11-select-workflow-status.sql**.

**Expect:** the same instance reaches `completed`, `grant_cents = 250000`, and the event trail records completion. The engine status matters, not only the app row.

## Slide 15: The Work Survived.

- **Show | Architecture, checkpoint 03:** queue, worker, scheduler removed.
- **Queue:** RabbitMQ holds and delivers funding messages; it does not execute the business logic.
- **Worker:** publishes the Postgres outbox to RabbitMQ, then consumes messages to run eligibility, risk, and grant processing.
- **Scheduler:** a separate time-driven loop for campaign expiration, expired-cache cleanup, and warehouse refresh.
- The scheduler does not feed RabbitMQ in this app; periodic maintenance and request-driven funding are separate paths.
- pg_durable now owns funding, expiration, and expired-cache cleanup.
- The warehouse refresh is still an explicit API activity at this checkpoint.
- Durable progress does not make arbitrary external effects exactly-once.
- If time permits: show scheduled expiration; protect the next chapter's start.

## Demo 15.1: Architecture Reveal

Show **Under the hood**, checkpoint **03**. Queue, worker, scheduler removed; **7 -> 4 containers**. Funding, expiration, and cache cleanup now have a database-side owner.

Optional scheduling proof: choose **Make WalkBlock due** on the architecture page. The durable maintenance tick, not that button, changes its state to `expired`. This mutates the demo campaign; skip if it distracts from the restart proof.

## Slide 16: Another Database. Another Copy.

- **Demo | App, checkpoint 03:** open Analytics; show the ClickHouse source and the existing dashboard.
- The existing dashboard depends on copying transactional data into a warehouse.
- pg_duckdb offers analytical execution over this Postgres data.
- Remove the copy pipeline for this workload; do not claim a warehouse benchmark.
- **Transition | Checkpoint 04:** after the warehouse dashboard, switch and reconnect for slide 17's app and DuckDB plan.

## Demo 16.1: Analytics Before the Replacement

Stay on **checkpoint 03** after the durable-workflow chapter. Open **Analytics** and show the **ClickHouse** source, fourteen daily bars, and four category totals.

On fresh checkpoint-03 data, expect **$123,820** and **874 backers**. The completed funding grant is a separate workflow record, not another backing; the opening's $25 pledge happened in checkpoint 00's separate database.

Explain the warehouse copy while this dashboard is visible. Then switch **03 -> 04**, reconnect VS Code, and continue directly to the same chart and its DuckDB query on slide 17.

## Slide 17: Same Dashboard. No Warehouse.

- **Demo | App + VS Code, checkpoint 04:**
  - Show the same chart and the new Postgres + pg_duckdb source.
  - Run all of sql/14-explain-duckdb-analytics.sql; point at DuckDBScan. Use sql/99-rollback.sql only if the transaction fails.
  - Show a new backing reflected on refresh without warehouse replication.
  - Show the architecture: ClickHouse and copy plumbing gone; three containers.
- Analytics now shares CPU, memory, I/O, and connection budgets with transactions.
- Keep analytics focused; skip extra plan detail if needed.

## Demo 17.1: Dashboard and DuckDB Plan

1. Confirm **checkpoint 04** and open **Analytics**. Compare the chart from slide 16: on fresh data, **$123,820**, **874 backers**, fourteen daily bars, four category totals. Show the new **Postgres + pg_duckdb** source.
2. In VS Code, run all of **[sql/14-explain-duckdb-analytics.sql](./sql/14-explain-duckdb-analytics.sql)**. It is the prepared analytics transaction, kept together so `SET LOCAL` and `COMMIT` cannot be missed:

   ```sql
   BEGIN READ ONLY;
   SET LOCAL duckdb.force_execution = true;

   EXPLAIN (ANALYZE, BUFFERS)
   SELECT (created_at AT TIME ZONE 'UTC')::date::text AS day,
     sum(amount_cents)::double precision AS amount_cents, count(*)::double precision AS backings
   FROM backings
   WHERE created_at >= (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - interval '13 days') AT TIME ZONE 'UTC'
   GROUP BY day ORDER BY day;

   COMMIT;
   ```

3. **Point at `Custom Scan (DuckDBScan)`.** The same chart alone would not prove DuckDB executed the query.
4. Back Honk with **$25**, then refresh Analytics. From fresh data, expect **$123,845** and **875 backers**, without waiting for a warehouse copy.
5. Show the architecture's analytics path: no ClickHouse, no copy pipeline; **4 -> 3 containers**.

`SET LOCAL` applies only inside this transaction. If a statement fails, run [sql/99-rollback.sql](./sql/99-rollback.sql) in the same editor connection. Do not leave an open transaction or set forced DuckDB execution globally. This tiny dashboard is not a warehouse benchmark.

## Slide 18: We Should Probably Ask Someone.

- pghacker connects an agent to PostgreSQL design history and source evidence.
- Mailing-list discussions, patches, commits, code; follow the original sources.
- This research corpus is separate from Kickstopper's application data.
- The hosted research session is an online exception to the prepared local demo.

## Slide 19: Why a Process per Connection?

- **Demo | VS Code + pghacker:**
  - Investigate the design history and tradeoffs of Postgres's process-per-connection model.
  - Show one useful result; open an original mailing-list or source citation.
  - Separate the historical rationale from current behavior and agent interpretation.
- Before rehearsal: verify a useful citation and capture a response/recording fallback.
- Bound the investigation; do not wait indefinitely on a hosted response.

## Demo 19.1: pghacker Investigation

Use this prompt:

> Why does PostgreSQL use separate backend processes for client connections rather than a thread-per-connection model? Find original pgsql-hackers discussions and relevant source or commits. For each important claim, provide a link and distinguish historical rationale, current implementation, and your own inference. If the evidence does not establish a claim, say so.

Show the answer, then open **one original citation**. Point at the actual discussion/source, its date/context, and the claim it supports. Do not stop at an agent-generated summary or present a paraphrase as a quotation.

**Expected proof:** a traceable answer, not a predetermined opinion. Verify the citation before the event; if this question does not produce a clear source, choose a rehearsed better-supported question rather than inventing the evidence.

## Slide 20: Now Review This Architecture.

- **Demo | VS Code + pghacker:**
  - Describe the moved search, cache, vectors, workflows, and analytics responsibilities.
  - Add the proposed next step: generated API, then React rendering inside Postgres.
  - Show the strongest objections about competing workloads and failure domains.
- Require a distinction between cited history, present behavior, and architectural inference.
- This is an agent's critique, not a PostgreSQL contributor's review or endorsement.

## Demo 20.1: Architecture Critique

Use this prompt:

> Our local crowdfunding demo has moved full-text search, a disposable UNLOGGED cache, pgvector similarity, pg_durable funding/timers, and pg_duckdb analytics into PostgreSQL. We next plan to replace Express with PostgREST, then run real React SSR in plv8 and serve HTML/assets with omni_httpd. PostgREST will remain a separate HTTP process. Find relevant design discussions and explain the strongest objections. Separate cited historical evidence, current behavior, and your architectural inference. Focus on workload contention, failure domains, and operations.

Show two or three well-supported concerns, not a long scrolling response. Then return to the deck and continue knowingly.

This is the agent's critique, not an actual PostgreSQL contributor's review or endorsement. If connectivity fails, use the captured response/source; if no capture exists, explain the intended investigation without claiming it ran.

## Slide 21: Anyway.

- The concerns are legitimate: contention, failure domains, operations.
- The joke is proceeding knowingly, not dismissing the evidence.
- Return to the demo; protect the finale.

## Slide 22: Delete the Application Server.

- Replace handwritten Express routes with generated resources and narrow SQL commands.
- PostgREST generates OpenAPI documentation too; Swagger UI renders it separately in the presentation.
- Validation, authorization, and atomic writes still need owners.
- PostgREST is a separate HTTP process, not code running inside Postgres.
- **Transition | Checkpoint 05:** switch during the explanation; reconnect VS Code.

## Slide 23: Generated. Not Unprotected.

- **Demo | App + VS Code, checkpoint 05:**
  - Open API docs; Swagger UI GET /projects, Try it out: id=eq.1, select=id,name. Show the real Honk response.
  - Deleted handwritten routes; generated API documentation too. Swagger UI adds no container.
  - Show a working backing or funding operation in the app.
  - In VS Code, inspect scoped resources, role grants, ownership policies, and a narrow write command.
  - Show that the handwritten backend runtime is absent.
- Browser JWT is a public local-demo identity, not database credentials or production authentication.
- Illustrate the authorization boundary; do not turn this into an RLS workshop.
- API explorer is anonymous and GET-only; documented operations do not prove permission to execute them.

## Demo 23.1: Swagger UI

1. In the presentation's checkpoint-05 demo toolbar, choose **API docs**, or open:
```text
   http://127.0.0.1:5173/api-docs.html?checkpoint=05&source=live
   ```

   Show the generated endpoint list in **Swagger UI**. Expand **GET /projects**, choose **Try it out**, set `id` to `eq.1` and `select` to `id,name`, then **Execute**.

   **Expect:** HTTP 200 and a JSON array containing Honk, returned by PostgREST rather than an Express route.

   Talking point: "We deleted the handwritten routes and got API documentation too." Be clear: PostgREST generates the OpenAPI description; the presentation hosts the separately bundled Swagger UI. This adds no container to either checkpoint.

   The explorer sends anonymous GET requests only. POST/PATCH/DELETE may appear in the generated description, but execution is disabled here; their appearance is not proof the current role may perform them. No JWT setup onstage. The raw description remains at <http://localhost:3000/api/>.

**Fallback:** in Images mode, **API docs** opens a captured schema with Try it out disabled. You can also choose **Captured schema** on the docs page. Its UI and schemas work offline, but do not claim a saved description executed a live request.

## Demo 23.2: Application Write and Database Permissions

1. In the app, back Honk with **$25** or request funding. The browser uses its local-demo JWT; use the app for this write rather than executing an administrator SQL command and calling that an authorization demo.
2. In VS Code, show the roles and owner policies:

   **Run [sql/15-select-api-roles.sql](./sql/15-select-api-roles.sql).**

   ```sql
   SELECT rolname, rolsuper, rolinherit
   FROM pg_roles
   WHERE rolname IN ('api_authenticator', 'web_anon', 'web_user', 'api_owner')
   ORDER BY rolname;
   ```

   **Run [sql/16-select-owner-policies.sql](./sql/16-select-owner-policies.sql).**

   ```sql
   SELECT schemaname, tablename, policyname, roles, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('funding_requests', 'workflow_events')
   ORDER BY tablename, policyname;
   ```

   **Point at:** non-superuser HTTP roles, `own_funding`, `own_events`, and the owner/actor predicates.

3. Open [07-generated-api.sql](./checkpoints/05-generated-api/database/07-generated-api.sql). Show `api.funding` / `api.events` as security-invoker views and one narrowly granted command such as `api.back_project`. Do not read the whole file.

Your saved VS Code login is the administrative demo account;it is not the browser role and can bypass ordinary RLS restrictions. Inspecting policies is not itself a full isolation test. The browser's public demo identity is also not a production authentication/approval policy.

## Slide 24: Still an HTTP Process.

- **Show | Architecture + source, checkpoint 05:** PostgREST remains outside Postgres.
- Frontend, PostgREST, Postgres: still three containers.
- Application server code disappeared; HTTP, roles, and operational work did not.
- Remember this process; it matters to the final asterisk.

## Demo 24.1: Show What Disappeared and What Remains

Compare the [04 backend directory](./checkpoints/04-analytics/backend/) with [checkpoint 05](./checkpoints/05-generated-api/): the handwritten backend runtime is absent.

Show **Under the hood**: frontend, **PostgREST**, Postgres. **3 -> 3 containers**, not another disappearing HTTP process.

## Slide 25: React. Inside Postgres.

- Real React server rendering inside plv8, not stored product HTML.
- omni_httpd serves the rendered document and built assets.
- Browser JavaScript and hydration still run in the browser.
- **Transition | Checkpoint 06:** switch while explaining the split; reconnect VS Code.

## Slide 26: SELECT render_page(1);

- **Demo | VS Code + app, checkpoint 06:**
  - Run sql/20-render-project.sql: execute React and show real Honk HTML.
  - Show the database-rendered project page.
  - Run WRITE sql/21-rename-project.sql; refresh and show fresh HTML without an asset rebuild.
  - Inspect the initial HTML; distinguish real SSR from an empty client shell or stored product page.
  - Show hydration and a product interaction; run WRITE sql/22-restore-project-name.sql.
- Protect this proof; do not repeat the earlier feature demos.

## Demo 26.1: Execute React and Open the Project

**Checkpoint 06.** Go straight to running React; no source-code or function-definition tour.

**Run [sql/20-render-project.sql](./sql/20-render-project.sql).**

```sql
SELECT render_page(1);
```

**Point at:** a complete HTML document with real Honk product markup, not an empty React mount point. React just executed inside Postgres.

Open **<http://localhost:3000/project/1>**. Use this document route, not merely a client-side hash route. Confirm the page says **Honk** before the rename; check this during rehearsal so there is no onstage preflight.

## Demo 26.2: Rename, Refresh, and Restore

1. Change the data in SQL:

**Run [sql/21-rename-project.sql](./sql/21-rename-project.sql). WRITE.**

   ```sql
   UPDATE public.projects
   SET name = 'Honk: now rendered in Postgres'
   WHERE id = 1 AND name = 'Honk'
   RETURNING id, name;
   ```

   **Expect one returned row.** The guard avoids overwriting a custom project name. If no row is returned, do not claim the rename happened; skip the rename proof and inspect the existing name offstage.

2. Refresh the browser. Show the changed product name without editing a template or rebuilding assets.
3. Prove it exists before browser JavaScript runs by opening the page source or inspecting the HTTP response:

   ```sh
   curl --fail --silent http://localhost:3000/project/1
   ```

   Look for the changed name in actual product markup, not just the bootstrap JSON/script. This distinguishes SSR from merely reloading a client-rendered page.

4. Show one hydrated product interaction, such as search. Browser JavaScript still runs in the browser.
5. Restore the original name. On seed data:

   **Run [sql/22-restore-project-name.sql](./sql/22-restore-project-name.sql). WRITE.**

   ```sql
   UPDATE public.projects
   SET name = 'Honk'
   WHERE id = 1 AND name = 'Honk: now rendered in Postgres'
   RETURNING id, name;
   ```

   **Expect one returned row with `Honk`.** If no row is returned, do not claim restoration; inspect the existing name offstage. This file only restores the demonstration name.

The proof is SQL -> actual React HTML -> fresh SQL change -> fresh server HTML. It is not an asset rebuild, a stored product-page snapshot, or a claim that the browser moved inside Postgres.

## Slide 27: Two Containers*

- **Show | Architecture, checkpoint 06:** giant Postgres box, visible PostgREST asterisk.
- Postgres owns SSR, page/static HTTP, and the moved database responsibilities.
- PostgREST retains the generated API, JWT, role-switching, and error contract.
- API docs also works on checkpoint 06; the same generated contract survives through the native HTTP proxy.
- No runtime frontend host or Node server; browser JavaScript remains in the browser.
- Larger failure domain, contention, extension packaging/upgrades; this is not a universal managed-service recipe.
- Two containers, not a secretly perfect one-container finale.

## Demo 27.1: Final Architecture Reveal

Show **Under the hood**, checkpoint **06**: **Postgres + PostgREST**, **3 -> 2 containers**. Postgres owns React SSR and page/static HTTP; the generated API/auth contract remains in the external PostgREST process.

## Demo 27.2: Optional API Docs Callback

The same Swagger UI is available from the checkpoint-06 **API docs** link or <http://127.0.0.1:5173/api-docs.html?checkpoint=06&source=live>. It uses the real API through omni_httpd's `/api/` proxy to PostgREST. The page checks the running checkpoint before loading the live schema.

Skip this if the React proof has already landed; there is no need to repeat the API demo.

## Slide 28: We Stopped Because the Conference Had Another Speaker.

- One quick reveal sequence; possibilities, not extra demonstrations.
- PostGIS + pgRouting; pg_graphql; omni_sqlite.
- omni_containers and omni_kube control external systems; their runtimes do not vanish.
- Tiny SQLite inside a cell: the joke gets smaller.
- Kubernetes usually manages Postgres; Postgres could have a turn, but there is another speaker.

## Slide 29: Would I Ship It?

- Search/cache: required semantics, disposable contents, independent scaling.
- Vectors: volume, recall requirements, transactional resource competition.
- Workflows: durable state helps; external effects still require idempotency.
- Analytics: useful until concurrency and scans crowd out transactions.
- Generated API: narrow grants, owner policies, explicit commands.
- React/HTTP: theatrical verdict; technical possibility is not operational advice.
- Fewer containers do not imply less software, maintenance, or responsibility.

## Slide 30: Three Questions.

- Did we remove operational work, or move it somewhere harder to see?
- Can the database absorb competing CPU, memory, I/O, and connections?
- Can we observe failures and separate the workload later?
- Favor reversible choices; keep ownership and failure modes explicit.

## Slide 31: Delete What You Don't Need.

- Delete unnecessary infrastructure, not necessary responsibilities.
- Point to the VS Code extension, pghacker, pgvector, DiskANN, and pg_durable.
- Share Twitter @holtbt and LinkedIn linkedin.com/in/btholt.
- Hold this slide for questions and any remaining recovery buffer.
- Leave https://holt.fyi/dyb visible for the deck and demo repository.

### Links to leave visible

- [Talk short link](https://holt.fyi/dyb)
- [Demo repository](https://github.com/btholt/postgres-talk-delete-your-backend)
- [Presentation](https://btholt.github.io/postgres-talk-delete-your-backend/)
- [VS Code + Postgres](https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-pgsql)
- [pghacker MCP](https://pghacker-mcp.dev/)
- [pgvector](https://github.com/pgvector/pgvector)
- [DiskANN](https://github.com/microsoft/DiskANN)
- [pg_durable](https://github.com/microsoft/pg_durable)
- [Twitter: @holtbt](https://twitter.com/holtbt)
- [LinkedIn](https://www.linkedin.com/in/btholt)

## Recovery: When a Live Demo Fails

1. Choose **Images**, press **I** in the local deck, or choose **Use images** in speaker view.
2. Continue through the slide-matched screenshots. The image checkpoint dropdown changes only the current slide's picture.
3. Describe the intended proof honestly. A static funding screenshot does not prove restart continuity; a screenshot does not execute a query plan or a pghacker investigation.
4. Return to Live only if you want to retry the actual services. Images mode does not stop/reset the running checkpoint.

For connection refusal, check `./scripts/demo status NN`, wait for health, and reconnect the existing profile. For a failed SQL transaction, run **[sql/99-rollback.sql](./sql/99-rollback.sql)** in the same SQL editor connection before retrying:

```sql
ROLLBACK;
```

Recovery only: this discards that connection's open transaction. Do not debug packaging or rebuild extensions onstage.
