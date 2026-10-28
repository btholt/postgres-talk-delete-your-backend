# 06 · React inside Postgres

The same Kickstopper product, now with **real React server-side rendering executing inside plv8**. **omni_httpd** serves that HTML and the browser assets from the same Postgres instance. Nginx and the frontend-host container disappear.

**3 → 2 containers, with an explicit asterisk:** Postgres plus PostgREST. The generated API process remains visible. This is not a hidden one-container stack or a stored, prerendered product page.

## Run it

Requirements: Docker Desktop/Compose, roughly 8 GB available to Docker, and ports **3000**, **3001**, and **54320** free.

```sh
# From this checkpoint, prepare while online:
./scripts/demo prepare --local
./scripts/demo start
```

Or, from the repository root:

```sh
./scripts/demo prepare 06 --local
./scripts/demo stop 05
./scripts/demo start 06
```

`--local` skips explicit service-image pulls, not uncached build dependencies/base images. Initial preparation downloads native donor images and builds pg_durable from pinned source. Build caches are reusable. All source, SQL, lockfiles, and image recipes are included here; neighboring checkpoints are not runtime or build dependencies.

After preparation, `start` uses `--no-build --pull never`. No inference, payments, CDN assets, fonts, or runtime downloads are needed. A same-architecture `docker image save` / `docker image load` transfer is another preparation option.

Open **http://localhost:3000/project/1**. The generated API is available at **http://localhost:3001** and through the native HTTP listener's **http://localhost:3000/api/** proxy.

The prepared switch is **not a live data migration**. Earlier volumes are preserved. Stop the previous checkpoint first.

```sh
./scripts/demo status
./scripts/demo logs
./scripts/demo stop
./scripts/demo start          # Preserves data, assets, and workflows.

# Destructive, limited to kickstopper-06-react-in-postgres_postgres-data:
./scripts/demo reset --confirm-delete-demo-data
```

## The finale

Connect the Microsoft PostgreSQL extension in VS Code to `localhost:54320`, database/user `kickstopper`, password `kickstopper-local`, SSL disabled. Reconnect after switching checkpoints.

```sql
SELECT render_page(1);
```

The result is a complete HTML document containing the real project components, not just an empty React mount point.

1. Open **http://localhost:3000/project/1**.
2. Execute:

   ```sql
   UPDATE projects SET name='Honk: now rendered in Postgres' WHERE id=1;
   ```

3. Refresh. The initial HTML and hydrated page contain the new SQL value, with no asset rebuild.
4. Inspect the response without running browser JavaScript:

   ```sh
   curl --fail --silent http://localhost:3000/project/1
   ```

5. Restore:

   ```sql
   UPDATE projects SET name='Honk' WHERE id=1;
   ```

6. Repeat the product tour: keyword search, prepared vector search, fake backing, human funding approval, analytics, and scheduled expiration. Open Under the hood for the giant Postgres rectangle and the visible **PostgREST*** box.

Verdict: **PLEASE DO NOT. But it renders.**

## Where the work went

```text
Browser ── GET / or /project/:id ──► Postgres / omni_httpd
                                      │
                                      └─ render_page → plv8 → React renderToString
                                         fresh public SQL rows + shared components

Browser ◄── real HTML + built CSS/JS ── Postgres / omni_httpd
   │
   └─ hydrate React; interactive /api/* requests
        └─ omni_httpd fixed-target proxy → PostgREST* → Postgres roles/RLS/commands
```

- [App.jsx](./frontend/src/App.jsx) is the existing product extracted from the browser entry, not a second hand-built HTML implementation.
- [render.jsx](./frontend/src/render.jsx) uses React's actual synchronous `renderToString`. The production legacy **browser** server-renderer entry avoids Node and streaming APIs. The self-contained IIFE is bundled at build time.
- [09-plv8.sql](./database/09-plv8.sql) implements `render_page`. Code is cached in the backend's role-specific V8 context; fresh rows and resource context are local to each call. There is no global per-request data cache.
- [package-renderer.mjs](./frontend/scripts/package-renderer.mjs) installs the compiled renderer, **empty HTML shell**, and exact built assets. It does not prerender project pages.
- [11-http.sql](./database/11-http.sql) serves the public HTML/assets and proxies only `/api/` to the fixed `api:3001` destination. Postgres port 8080 is published as host port 3000.
- [main.jsx](./frontend/src/main.jsx) hydrates the same components with the same bootstrap data. Missing production bootstrap data is an error, not a silent client-only fallback.

**Browser JavaScript still runs in the browser.** Public browse/detail pages receive SSR. Private funding records, analytics, search, similarity, backing, and approvals continue using the existing browser/API behavior. Related projects load after hydration. Public links use real `/project/:id` document navigation; private screens retain hash routing. HTTP does not receive URL fragments.

The public SSR GET reads project views directly, without refilling the writeable summary cache. Browser revalidation still uses the original cache/full-text/vector RPCs. The cache's TTL, transactional invalidation, and pg_durable cleanup are unchanged.

## The asterisk is intentional

Native HTTP works inside Postgres. The remaining limitation is the generated API contract, not static hosting.

The inspected OmniREST compatibility layer is not a drop-in replacement for the verified JWT verification/role switching and custom error/status behavior. Replacing it would require new gateway/authentication code. Instead, the existing **PostgREST 16.5 process remains external and visible**.

No Node, Nginx, or concealed PostgREST process runs in the database container. Node is used only during builds and by the development-only test driver. The `frontend/` directory remains because both renderers need its source; its runtime Dockerfile and Nginx configuration are removed.

## Permissions and product invariants

The API schema, SQL commands, RLS, public fake-founder JWT, and read-only DuckDB bridge are unchanged from 05.

- `web_renderer` is a non-superuser, non-login role inheriting only `web_anon`. It can read public project/preset columns and the shell/assets, not funding records or embeddings, and cannot write project rows.
- `render_page` is a fixed-search-path definer function owned by `web_renderer`. HTTP handlers also execute as that restricted role. The API login cannot impersonate it.
- Only `api` is exposed through PostgREST. The authenticator can switch only to `web_anon` or `web_user`.
- Owner-scoped invoker views/RLS and narrow `api_owner` commands preserve atomic fake backing, idempotency, funding ownership, and durable intent.
- `analytics_executor` remains a restricted read-only connection to this **same** instance. Actual DuckDB aggregation is preserved without enabling unsafe function execution.
- Bootstrap JSON escapes HTML-significant characters and line separators; React escapes product markup. No private identity fields are serialized into public pages.

These are **public, disposable local-demo credentials and JWT fixtures**, not production authentication. No database credentials/signing key are put in the browser. Keep host bindings on loopback; do not use real money/data or expose the stack publicly.

## Native compatibility and operational cost

The independently buildable [database image](./database/Dockerfile) combines Postgres **17.8**, pgvector **0.8.1**, pg_durable **0.2.9**, pg_duckdb release **1.1.1** (extension schema **1.1.0**), plv8 **3.2.4**, and omni_httpd **0.4.11**. Native binary donors are digest-pinned; only the HTTP dependency closure and required LLVM runtime libraries are copied. The full product, real DuckDB plans, HTTP/SSR, and same-volume workflow restart were exercised together natively on ARM64.

Both plv8/Omnigres donors target PG17.6; this prepared runtime is PG17.8. Omnigres emits a minor-version warning and can emit a parallel-worker configuration warning. Those warnings are not hidden. This demonstrates this pinned combination, not arbitrary future extensions, warning-free upstream packaging, or availability on every managed Postgres service.

This plv8 build has **no Intl** and no optional `plv8.execution_timeout` GUC. The existing browser uses Intl unchanged; the renderer needs only a small, tested en-US formatter for integer counts and integer USD cents. It does not pretend to implement general locale support. No browser/Node runtime polyfill or streaming renderer is smuggled in.

SSR and HTTP now share database CPU, memory, process slots, upgrades, and failure domain with transactions and durable work. We set two HTTP workers and reserve 32 worker slots for this prepared local workload. A renderer/extension failure is a database concern now. Trusted compiled demo code is not an arbitrary JavaScript execution service. Separating web workloads is still a very sensible default.

Assets and the compiled renderer are initialized into the database volume. After editing build source, rebuild **and explicitly reset this checkpoint** to refresh those rows. Ordinary start/restart deliberately does not overwrite persistent data or perform a hidden migration. During frontend development, `npm run dev` uses Vite's explicitly development-only client renderer and the existing API proxy; production SSR must be tested through Compose.

## Verification

Start with fresh 06 data, then:

```sh
cd tests
npm ci
npm test
```

The tests mutate demo data and restart this checkpoint's Postgres container. Reset explicitly afterward for presentation data.

The preserved API/rule tests cover full-text/cache behavior, all vector rankings, atomic/idempotent backing, funding approval/rejection/eligibility, cross-owner isolation, forged roles/JWTs, direct-write/private-schema denial, real read-only DuckDB execution, expiration, and maintenance.

[react-ssr.js](./tests/test/react-ssr.js) adds real plv8/read-only execution, renderer permissions, complete HTTP markup, exact asset bytes/types, live SQL updates, HTML/script escaping, formatting boundaries, missing routes/methods, request-data isolation, and the two-service/port inventory.

[durable-restart.js](./tests/test/durable-restart.js) proves the same container, volume, instance ID, root node, creation time, completed steps, and one maintenance instance survive restart. It also checks real SSR after recovery. Browser checks cover hydration errors, product flows, and mobile/desktop layout.

For fallback capture, record the SQL render, live SQL update and browser refresh, product interaction, same-instance restart, and honest two-container diagram. No recording is claimed to exist.
