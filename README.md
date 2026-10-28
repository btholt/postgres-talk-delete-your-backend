# Delete Your Backend

**Kickstopper:** a complete crowdfunding product for terrible startup ideas, then progressively less architecture.

**[View the presentation](https://btholt.github.io/postgres-talk-delete-your-backend/)** on GitHub Pages. The public deck uses captured demo images and API schemas, not running services. Every push to `main` tests, builds, and redeploys the slides through [GitHub Actions](./.github/workflows/pages.yml).

The implementation brief is [AGENT.md](./AGENT.md). Seven independent checkpoints are available:

- [00 · Original architecture](./checkpoints/00-original/README.md): React/Nginx, Express, Redis, RabbitMQ with an explicit worker, a scheduler, Meilisearch, Qdrant, ClickHouse, and Postgres.
- [01 · Search and cache](./checkpoints/01-search-and-cache/README.md): the same app with Redis and Meilisearch removed; Postgres owns full-text search and a disposable UNLOGGED summary cache. **10 → 8 containers.**
- [02 · Vectors](./checkpoints/02-vectors/README.md): the same app with Qdrant removed; pgvector stores the same prepared embeddings and performs cosine similarity. **8 → 7 containers.**
- [03 · Durable workflows](./checkpoints/03-durable-workflows/README.md): pg_durable takes over funding and timers; RabbitMQ, its worker, and the scheduler disappear. **7 → 4 containers.**
- [04 · Analytics](./checkpoints/04-analytics/README.md): the same dashboard reads Postgres through pg_duckdb; ClickHouse, snapshots, and HTTP refresh plumbing disappear. **4 → 3 containers.**
- [05 · Generated API](./checkpoints/05-generated-api/README.md): Express and its runtime disappear; PostgREST exposes scoped resources/commands backed by roles and owner policies. **Still 3 containers: the HTTP process remains.**
- [06 · React inside Postgres](./checkpoints/06-react-in-postgres/README.md): real React SSR executes in plv8; omni_httpd serves HTML/assets and the frontend host disappears. **3 → 2 containers, with PostgREST visibly retained for the generated API/auth contract.**
- [Presenter runbook and status](./RUNBOOK.md): exact startup and opening-tour actions, tradeoffs, and outstanding work.
- [Slide-by-slide presenter guide](./demo.md): the single source for all speaker notes, interspersed demos, numbered SQL, and expected results, with large Slide/Demo headings for phone reading.
- [Runnable demo SQL](./sql/): numbered files in talk order, ready for the VS Code PostgreSQL extension's Run button; filenames and full queries are in the walkthrough.
- [Presentation app](./slides/README.md): Markdown slides, speaker notes, interactive demo/architecture iframes, and a local checkpoint-switching dropdown. Run `cd slides && npm ci && npm start`.

## Start checkpoint 00

With Docker Desktop running:

```sh
./scripts/demo prepare 00   # Online: pull pinned images and build the applications.
./scripts/demo start 00     # Offline-ready: no image pulls or builds.
```

Open **http://localhost:3000**.

```sh
./scripts/demo status 00
./scripts/demo stop 00
./scripts/demo start 00     # Ordinary restart preserves data.

# Destructive reset, limited to this checkpoint's demo volumes:
./scripts/demo reset 00 --confirm-delete-demo-data
```

All money and grants are fake. Credentials are public local-demo examples. This is not a public deployment or a production authorization model.

## Switch to checkpoint 01

```sh
./scripts/demo prepare 01 --local  # Skip service-image pulls if already prepared locally.
./scripts/demo stop 00
./scripts/demo start 01
```

`--local` skips image pulls, not network access needed for any missing build dependency. After preparation, `start` is offline-ready. Use `status`, `logs`, `stop`, and explicit `reset` with `01` just as with `00`.

## Switch to checkpoint 02

```sh
# Only this database image is new if checkpoint 01 is already prepared.
docker compose -f checkpoints/02-vectors/compose.yaml pull postgres
./scripts/demo prepare 02 --local
./scripts/demo stop 01
./scripts/demo start 02
```

Use ordinary `./scripts/demo prepare 02` on a fresh machine. Checkpoint 02 pins native pgvector 0.8.1/Postgres 17.8 by image digest; npm packages are unchanged from 01.

## Switch to checkpoint 03

```sh
./scripts/demo prepare 03 --local  # One-time native pg_durable build; prepare online.
./scripts/demo stop 02
./scripts/demo start 03           # No downloads or compilation after preparation.
```

The native image combines pg_durable 0.2.9, pgvector 0.8.1, and Postgres 17.8. Upstream pg_durable images are amd64-only, so this checkpoint builds from pinned source rather than emulating them on Apple Silicon. Initial preparation is substantially heavier; the built image and compiler caches are reusable.

The same-instance restart demonstration uses `docker compose restart postgres` inside checkpoint 03, **not** reset or a checkpoint switch. The UI displays the real eight-character durable instance ID separately from the request UUID. The existing Express API still performs the explicitly labeled ClickHouse refresh activity; pg_durable owns its scheduling.

## Switch to checkpoint 04

```sh
./scripts/demo prepare 04 --local
./scripts/demo stop 03
./scripts/demo start 04
```

Preparation adds the digest-pinned native pg_duckdb donor image and reuses the prior compiler layers when available. Application packages and lockfiles are unchanged. Normal `start 04` makes no downloads or builds.

The dashboard preserves the existing chart/data shape, now querying current Postgres data with real DuckDB execution. The warehouse service/volume/configuration, snapshot helper, internal refresh endpoint/key, and durable HTTP step are removed. Funding, campaign expiration, and cache cleanup remain in pg_durable. HTTP/cloud access is disabled for this local-only workload.

## Switch to checkpoint 05

```sh
./scripts/demo prepare 05 --local
./scripts/demo stop 04
./scripts/demo start 05
```

PostgREST 16.5 is a native separate HTTP process. There is no `backend/` runtime, Express dependency, or Node server. The existing screens use a small browser adapter; validation, atomic writes, ownership, and durable intent live in Postgres.

The browser uses an explicitly public local-demo JWT, not database credentials. Funding/events use owner-scoped RLS; write commands are narrowly granted. The analytics RPC uses a fixed read-only loopback connection to the same database to retain real DuckDB execution without enabling unsafe function execution. See the [05 README](./checkpoints/05-generated-api/README.md) for the role model and compatibility boundary.

## Switch to checkpoint 06

```sh
./scripts/demo prepare 06 --local
./scripts/demo stop 05
./scripts/demo start 06
```

Open **http://localhost:3000/project/1**. The initial product HTML is rendered by real React inside plv8 and served by omni_httpd in the same Postgres instance. The browser hydrates it and continues running the existing interactive app. `SELECT render_page(1);`, a live SQL data change, and refresh form the finale.

The honest inventory is **Postgres + PostgREST**, not one secretly perfect container. Native HTTP and SSR are proven together with pgvector, pg_durable, and pg_duckdb on this ARM64 laptop, including the same-volume workflow restart. The external API process preserves the existing JWT, role switching, and response contract rather than being replaced by a custom gateway.

Checkpoint switching is a prepared transition, **not a live data migration**. Stop the previous checkpoint first; each implementation uses the same public ports and a different persistent database volume. Starting or resetting one checkpoint preserves the others' data.
