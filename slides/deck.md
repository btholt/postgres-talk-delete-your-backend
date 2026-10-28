<!-- .slide: id="opening" data-layout="title" data-checkpoint="00" -->

<p class="eyebrow">WEB UNLEASHED / BRIAN HOLT</p>

# Delete your<br />backend<span class="accent">.</span>

<p class="lede">Your whole stack, inside Postgres.</p>

---

<!-- .slide: id="brian" data-layout="content" -->

<p class="eyebrow">HELLO FROM SEATTLE</p>

## Brian Holt<span class="accent">.</span>

<p class="lede bio-employer"><span>Principal PM,</span><img class="microsoft-wordmark" src="./logos/microsoft-wordmark.svg" width="211" height="45" alt="Microsoft"></p>
<p class="role-line">Postgres DevX + AI</p>
<p class="bio-history">Previously: Stripe / Netflix / Neon/Databricks / Snowflake / Reddit</p>
<p class="slide-caption">Would rather be snowboarding. Sports fan. Minor investor in <span class="bio-brand"><img class="bio-logo" src="./logos/cagliari-calcio.png" width="32" height="32" alt="" aria-hidden="true">Cagliari Calcio</span>.</p>

---

<!-- .slide: id="product" data-layout="split" data-demo="explore" data-checkpoint="00" -->

<p class="eyebrow">KICKSTOPPER / CHECKPOINT 00</p>

## Big ideas.<br />Questionable<br />judgment.

<p class="slide-caption">Real application. Fake money.</p>

---

<!-- .slide: id="architecture" data-layout="demo" data-demo="architecture" data-checkpoint="00" -->

<p class="eyebrow">THE APP IS FINISHED</p>

## Unfortunately, so is the architecture.

---

<!-- .slide: id="rules" data-layout="content" -->

<p class="eyebrow">THE RULES</p>

## Same product.<br />Less plumbing.

- Keep the features. <!-- .element: class="fragment" -->
- Account for the work. <!-- .element: class="fragment" -->
- Show what remains. <!-- .element: class="fragment" -->

---

<!-- .slide: id="search" data-layout="split" data-demo="explore" data-checkpoint="00" -->

<p class="eyebrow">01 / SEARCH + CACHE</p>

## Search is<br />data, too.

<div class="responsibility-flow">
  <span>Meilisearch + Redis</span><span class="flow-arrow" aria-label="moves to">&rarr;</span><strong>Postgres</strong>
</div>
<p class="slide-caption">Full-text search. A disposable UNLOGGED cache.</p>

---

<!-- .slide: id="vscode" data-layout="content" data-checkpoint="01" -->

<p class="eyebrow">THE WORKBENCH</p>

## Postgres.<br />Meet your editor.

<p class="lede"><a href="https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-pgsql" target="_blank" rel="noopener noreferrer">Microsoft PostgreSQL extension for VS Code</a></p>
<p class="slide-caption">Connect / Explore / Query / Explain</p>

---

<!-- .slide: id="query-plan" data-layout="split" data-demo="explore" data-checkpoint="01" data-sql="01-select-search-documents.sql 02-search-projects.sql 03-show-search-index.sql" -->

<p class="eyebrow">LIVE DEMO / VS CODE + APP</p>

## Same search.<br />One less service.

<div class="sql-anchor"><code>tsvector + GIN</code></div>
<p class="slide-caption">Enough search for this product.</p>

---

<!-- .slide: id="cache" data-layout="split" data-demo="architecture" data-checkpoint="01" data-sql="04-show-cache-definition.sql 05-select-cache.sql" -->

<p class="eyebrow">01 / SEARCH + CACHE</p>

## Two boxes<br />down.

<p class="container-count">10 <span>&rarr;</span> 8</p>
<div class="verdict">SHIP IT<span>For this workload.</span></div>

---

<!-- .slide: id="vectors" data-layout="split" data-demo="explore" data-checkpoint="01" -->

<p class="eyebrow">02 / VECTORS</p>

## Similarity is<br />data, too.

<p class="lede">pgvector</p>
<p class="slide-caption">Prepared embeddings. No inference calls.</p>
<p class="footnote">Worth exploring: <a href="https://github.com/microsoft/DiskANN" target="_blank" rel="noopener noreferrer">DiskANN</a> / Microsoft Research / large-scale approximate nearest-neighbor search.</p>

---

<!-- .slide: id="similarity" data-layout="split" data-demo="explore" data-checkpoint="02" data-sql="06-show-vector-extension.sql 07-select-embeddings.sql 08-find-similar-projects.sql" -->

<p class="eyebrow">LIVE DEMO / APP + VS CODE</p>

## Same weird.<br />One fewer<br />database.

<p class="container-count">8 <span>&rarr;</span> 7</p>

---

<!-- .slide: id="plumbing" data-layout="split" data-demo="funding" data-checkpoint="02" -->

<p class="eyebrow">03 / DURABLE WORKFLOWS</p>

## The work.<br />And all its plumbing.

<div class="responsibility-flow"><span>Queue</span><span>Worker</span><span>Scheduler</span></div>

---

<!-- .slide: id="workflows" data-layout="content" data-checkpoint="03" data-sql="09-select-funding-request.sql" -->

<p class="eyebrow">pg_durable</p>

## Waiting is<br />part of the work.

<ol class="workflow-steps">
  <li>Eligibility</li><li>Risk</li><li>Human approval</li><li>Grant</li>
</ol>

---

<!-- .slide: id="restart" data-layout="split" data-demo="funding" data-checkpoint="03" data-sql="09-select-funding-request.sql 10-select-durable-instance.sql 11-select-workflow-status.sql 12-select-workflow-events.sql 13-select-database-start-time.sql" -->

<p class="eyebrow">LIVE DEMO / APP + VS CODE</p>

## Let's restart<br />the database.

<p class="slide-caption">Same volume. Same instance.</p>

---

<!-- .slide: id="survived" data-layout="split" data-demo="architecture" data-checkpoint="03" -->

<p class="eyebrow">03 / DURABLE WORKFLOWS</p>

## The work<br />survived.

<p class="container-count">7 <span>&rarr;</span> 4</p>
<div class="verdict">SHIP IT<span>Idempotency still matters.</span></div>

---

<!-- .slide: id="warehouse" data-layout="split" data-demo="analytics" data-checkpoint="03" -->

<p class="eyebrow">04 / ANALYTICS</p>

## Another database.<br />Another copy.

<div class="responsibility-flow"><span>Copy to ClickHouse</span><span class="flow-arrow" aria-label="replaced by">&rarr;</span><strong>Query with pg_duckdb</strong></div>

---

<!-- .slide: id="analytics" data-layout="demo" data-demo="analytics" data-checkpoint="04" data-sql="14-explain-duckdb-analytics.sql 99-rollback.sql" -->

<p class="eyebrow">LIVE DEMO / APP + VS CODE / 4 &rarr; 3 CONTAINERS</p>

## Same dashboard. No warehouse.

---

<!-- .slide: id="pghacker" data-layout="content" -->

<p class="eyebrow">AN OUTSIDE OPINION</p>

## We should probably<br />ask someone.

<p class="lede"><a href="https://pghacker-mcp.dev/" target="_blank" rel="noopener noreferrer">pghacker MCP</a></p>
<p class="slide-caption">Design history / Source / Citations</p>

---

<!-- .slide: id="evidence" data-layout="content" -->

<p class="eyebrow">LIVE DEMO / VS CODE + pghacker</p>

## Why a process<br />per connection?

<p class="slide-caption">Ask a question. Open the evidence.</p>

---

<!-- .slide: id="critique" data-layout="content" -->

<p class="eyebrow">LIVE DEMO / VS CODE + pghacker</p>

## Now review<br />this architecture.

<div class="responsibility-flow"><span>Evidence</span><span>Current behavior</span><span>Inference</span></div>

---

<!-- .slide: id="anyway" data-layout="content" -->

<p class="eyebrow">WE HAVE CONSIDERED THE ADVICE</p>

## Anyway<span class="accent">.</span>

---

<!-- .slide: id="generated-api" data-layout="content" data-checkpoint="05" -->

<p class="eyebrow">05 / GENERATED API</p>

## Delete the<br />application server.

<div class="responsibility-flow"><span>Express</span><span class="flow-arrow" aria-label="replaced by">&rarr;</span><strong>PostgREST</strong></div>

---

<!-- .slide: id="permissions" data-layout="split" data-demo="explore" data-checkpoint="05" data-sql="15-select-api-roles.sql 16-select-owner-policies.sql" -->

<p class="eyebrow">LIVE DEMO / APP + VS CODE</p>

## Generated.<br />Not unprotected.

<p class="slide-caption">Roles / Row-level security / Narrow commands</p>

---

<!-- .slide: id="http" data-layout="split" data-demo="architecture" data-checkpoint="05" -->

<p class="eyebrow">05 / GENERATED API</p>

## Still an<br />HTTP process.

<p class="container-count">3 <span>&rarr;</span> 3</p>
<p class="slide-caption">Less application code. Not fewer processes.</p>

---

<!-- .slide: id="react" data-layout="content" data-checkpoint="06" -->

<p class="eyebrow">06 / ONE RUNTIME TOO FAR</p>

## React.<br />Inside Postgres.

<p class="lede">plv8 + omni_httpd</p>
<p class="slide-caption">Server rendering. Native HTTP. Browser hydration.</p>

---

<!-- .slide: id="render" data-layout="split" data-demo="project" data-checkpoint="06" data-sql="20-render-project.sql 21-rename-project.sql 22-restore-project-name.sql" -->

<p class="eyebrow">LIVE DEMO / VS CODE + APP</p>

## <code>SELECT<br />render_page(1);</code>

<p class="slide-caption">SQL &rarr; React &rarr; HTML</p>

---

<!-- .slide: id="asterisk" data-layout="split" data-demo="architecture" data-checkpoint="06" -->

<p class="eyebrow">06 / THE ASTERISK STAYS</p>

## Two containers<span class="accent">*</span>

<p class="container-count">3 <span>&rarr;</span> 2</p>
<p class="process-caption">Postgres + PostgREST</p>
<div class="verdict danger">PLEASE DO NOT<span>But it renders.</span></div>

---

<!-- .slide: id="bonus" data-layout="content" -->

<p class="eyebrow">BONUS POSSIBILITIES / NOT IMPLEMENTED DEMOS</p>

## We stopped because<br />the conference had<br />another speaker.

<ul class="bonus-list">
  <li class="fragment">Maps + routing <span>PostGIS + pgRouting</span></li>
  <li class="fragment">GraphQL <span>pg_graphql</span></li>
  <li class="fragment">A database per cell <span>omni_sqlite</span></li>
  <li class="fragment">Container deployment <span>omni_containers</span></li>
  <li class="fragment">Kubernetes administration <span>omni_kube</span></li>
</ul>
<div class="bonus-postgres" aria-label="Illustration: SQLite inside a Postgres table cell">
  <strong>Postgres</strong>
  <div class="tiny-table"><span>row</span><span>value</span><span>1</span><span class="tiny-sqlite">SQLite</span></div>
</div>

---

<!-- .slide: id="scoreboard" data-layout="content" -->

<p class="eyebrow">THE HONEST SCOREBOARD</p>

## Would I ship it?

<table class="scoreboard">
  <thead><tr><th scope="col">Responsibility</th><th scope="col">Verdict</th><th scope="col">Watch for</th></tr></thead>
  <tbody>
    <tr><th scope="row">Search + cache</th><td><span class="score-ship">SHIP IT</span></td><td>Search needs / cache loss</td></tr>
    <tr><th scope="row">Vectors</th><td><span class="score-ship">SHIP IT</span></td><td>Recall / scale</td></tr>
    <tr><th scope="row">Workflows</th><td><span class="score-ship">SHIP IT</span></td><td>Idempotency</td></tr>
    <tr><th scope="row">Analytics</th><td><span class="score-caution">FINE UNTIL IT ISN'T</span></td><td>Transactional contention</td></tr>
    <tr><th scope="row">Generated API</th><td><span class="score-ship">SHIP IT</span></td><td>Roles + policies</td></tr>
    <tr><th scope="row">React + HTTP</th><td><span class="score-danger">WAR CRIME</span></td><td>Failure domain</td></tr>
  </tbody>
</table>
<p class="footnote">For this workload. Not universal endorsements.</p>

---

<!-- .slide: id="questions" data-layout="content" -->

<p class="eyebrow">BEFORE DELETING A SERVICE</p>

## Three questions.

<ol class="takeaways">
  <li class="fragment">Less operational work?</li>
  <li class="fragment">Enough headroom?</li>
  <li class="fragment">An observable exit path?</li>
</ol>

---

<!-- .slide: id="closing" data-layout="content" -->

<p class="eyebrow">THANK YOU / BRIAN HOLT</p>

## Delete what<br />you don't need<span class="accent">.</span>

<div class="resource-links">
  <a href="https://github.com/btholt/postgres-talk-delete-your-backend" target="_blank" rel="noopener noreferrer">Demo repository</a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-pgsql" target="_blank" rel="noopener noreferrer">VS Code + Postgres</a>
  <a href="https://pghacker-mcp.dev/" target="_blank" rel="noopener noreferrer">pghacker MCP</a>
  <a href="https://github.com/pgvector/pgvector" target="_blank" rel="noopener noreferrer">pgvector</a>
  <a href="https://github.com/microsoft/DiskANN" target="_blank" rel="noopener noreferrer">DiskANN</a>
  <a href="https://github.com/microsoft/pg_durable" target="_blank" rel="noopener noreferrer">pg_durable</a>
</div>
<div class="resource-links social-links">
  <a href="https://twitter.com/holtbt" target="_blank" rel="noopener noreferrer">Twitter: @holtbt</a>
  <a href="https://www.linkedin.com/in/btholt" target="_blank" rel="noopener noreferrer">linkedin.com/in/btholt</a>
</div>
