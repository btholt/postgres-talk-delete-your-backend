# Delete Your Backend presentation

A 31-slide Reveal.js talk with sparse audience copy, bullet-point speaker notes, major demo beats, reversible reveals, and real Kickstopper iframes. The rough plan is **40 minutes plus 5 minutes for questions and demo recovery**, without live per-slide pacing.

## Talk map

| Time | Slides | Chapter |
|---|---|---|
| 00:00-04:00 | 1-5 | Brian, Kickstopper, original architecture, experiment rules |
| 04:00-09:00 | 6-9 | Search/cache and the VS Code PostgreSQL extension spotlight |
| 09:00-11:00 | 10-11 | pgvector; DiskANN as a linked footnote only |
| 11:00-18:00 | 12-15 | Durable workflows and the same-instance restart |
| 18:00-21:00 | 16-17 | pg_duckdb analytics |
| 21:00-26:00 | 18-21 | pghacker investigation, original evidence, architectural critique |
| 26:00-29:00 | 22-24 | Generated API, roles/policies, visible PostgREST process |
| 29:00-35:00 | 25-27 | Real React SSR, live SQL edit, honest two-container finale |
| 35:00-40:00 | 28-31 | Bonus possibilities, verdicts, decision framework, resources |
| 40:00-45:00 | Hold 31 | Questions / recovery buffer |

The [presenter guide](../demo.md) is the source of truth for speaking points and demos, in slide order. Large `## Slide N: Title` headings introduce the brief topic bullets; `## Demo N.M: Title` headings immediately below contain the detailed actions. Read just that one guide on your phone. The schedule above is a planning reference only; notes and speaker view have no per-slide budgets, countdowns, or pacing indicators.

The opening only browses and backs a project. Feature demos are interleaved with their replacements: original app search on slide 6, then the same app search and GIN SQL together on slide 8; Qdrant/pgvector on slides 10-11; original funding/durable restart on slides 12-15; ClickHouse/DuckDB on slides 16-17. Each chapter shows the existing feature before switching checkpoints. The embedded app, brief notes, and detailed guide follow that same sequence.

For exact actions, SQL, expected results, and what to show, use the same [presenter guide](../demo.md), particularly the [product-search replacement](../demo.md#gin-demo). The search chapter uses the actual app and its GIN-backed implementation, not a synthetic index benchmark.

Every stage query is a numbered file in the root [sql/](../sql/) directory. The guide shows the full SQL beside its filename. Optional speaker view reads the initial bullet list from each guide Slide section, then lists the relevant SQL files in expandable sections via `data-sql` on the slide. Edit speaking points only in `demo.md`; there is no second `Notes:` copy to maintain in the deck. The audience never sees those SQL sections. Only files 21/22 rename/restore the product; file 99 is transaction recovery, not a normal demo step.

The React finale starts directly with query 20, `SELECT render_page(1);`, then the browser page and queries 21/22 for rename, refresh, and restore. Queries 17-19 are retained for rehearsal/debugging, not shown in the live guide or speaker-view query list.

Before presenting, rehearse the pghacker questions, verify an original citation, and capture fallback responses/recordings. No research response or recording is claimed to exist. The closing slide links to the [public demo repository](https://github.com/btholt/postgres-talk-delete-your-backend).

## Present locally

Use Node 24 (the prepared runtime is pinned in `.nvmrc`):

```sh
cd slides
npm ci
npm start
```

Open **http://127.0.0.1:5173**. Docker Desktop must be running to control the demo. Prepare the checkpoints you intend to use beforehand with the root runner, for example:

```sh
./scripts/demo prepare 00
./scripts/demo prepare 06 --local
```

The **Demo checkpoint** dropdown starts the selected real checkpoint, in either direction, independently of slide navigation. It checks that its images exist before stopping the current stack, then uses the existing runner's health-checked, offline `start`. No image builds, pulls, resets, or volume deletions occur. Open the status strip to see progress and errors. If startup fails after stopping a healthy checkpoint, the controller attempts to restore that checkpoint and still reports the failed switch.

Checkpoints have separate persistent volumes. This is a prepared implementation switch, **not a live data migration**. Reconnect your SQL tools after switching. The architecture iframe shows the running app's own diagram, including retained processes, rather than a second diagram that can drift.

The controller binds only to loopback. Its endpoints require a per-server random token; mutations additionally require a same-origin request. Do not expose this development server through a tunnel or bind it to a public interface. It intentionally controls local Docker processes.

Iframe URLs are versioned on each switch/reload so the browser cannot accidentally show cached HTML from the previous checkpoint on the same port.

## Swagger UI for checkpoints 05 and 06

The **API docs** link appears in demo toolbars when checkpoint **05** or **06** is selected. It opens the separately bundled Swagger UI:

- **05:** <http://127.0.0.1:5173/api-docs.html?checkpoint=05&source=live>
- **06:** <http://127.0.0.1:5173/api-docs.html?checkpoint=06&source=live>

The real checkpoint must already be running. This page's checkpoint selector identifies the expected API; it does not switch Docker. A mismatch or unavailable API is an explicit error, never a silent fallback.

Show **GET /projects -> Try it out**, set `id` to `eq.1` and `select` to `id,name`, then execute. Swagger UI and its styles are bundled locally, not fetched from a CDN. PostgREST supplies the live OpenAPI description through the app's `/api/` proxy. Swagger UI is presentation tooling, not another application container.

The explorer allows only anonymous **GET** requests to the fixed local public resources, with no browser JWT or credentials. Other documented operations remain visible but cannot be tried here; the generated listing alone does not demonstrate authorization. The live example shows Honk without adding fake pledges or changing demo data.

In Images mode, or in a production/static build, the link opens **Captured schema**. Both real checkpoint schemas are bundled for offline browsing; Try it out is disabled and no localhost requests are made. This is generated documentation, not a saved successful response. To refresh the captures after API changes:

```sh
npm run capture:api-specs -- --allow-checkpoint-switches
```

Like screenshot capture, this read-only helper temporarily switches 05/06 and restores the original healthy checkpoint without resets. The full Swagger bundle is loaded only by `api-docs.html`, not the slide deck.

## Emergency Images mode

Choose **Images** in the top bar, press **I** in the local deck, or choose **Use images** in speaker view. Every live demo iframe is unloaded and replaced with a bundled screenshot. Images mode makes **no Docker-controller or live-app requests**, including when starting directly with `?demo=images`. The mode is remembered across refreshes.

Images automatically match each slide's checkpoint. In the local presenter app, **Image checkpoint** overrides the screenshot on the current slide only; moving to another slide restores that slide's planned checkpoint. These selections never start/stop Docker. The public/static build disables this selector so images always follow the slides. Long screenshots scroll inside the same demo area, just like the live app. **Open image** opens the local capture at full size.

The snapshots cover all seven checkpoints and all five app views (browse, architecture, funding, analytics, project), so manual overrides also work offline. Speaker previews use these captures too, including a current-slide override. Image labels explicitly identify a captured snapshot rather than live telemetry. The public/static build defaults to Images mode.

Returning to **Live** resumes status checks and the currently running stack. Choosing Images does not stop that stack or cancel a checkpoint transition already accepted by the controller. This fallback covers the app iframes, not a recording of VS Code, the workflow restart, or the hosted pghacker session.

### Refresh the captures

With one healthy checkpoint running and all seven checkpoints prepared:

```sh
cd slides
npm run capture:images -- --allow-checkpoint-switches
```

The capture helper temporarily cycles through checkpoints, takes read-only screenshots without resets or initiating business actions, and restores the original checkpoint even after a capture error. It uses isolated headless Microsoft Edge on this Mac; set `BROWSER_BIN` to another Chromium executable if needed. Do not interrupt checkpoint switching. The generated `public/demo-images/manifest.json` records capture time, routes, and dimensions. Run tests/build after refreshing the captures.

## Author slides

Edit [deck.md](./deck.md). Separate slides with `---`. Give every slide a stable, unique ID:

```markdown
<!-- .slide: id="my-slide" data-layout="split" data-demo="architecture" data-checkpoint="01" -->

<p class="eyebrow">A CHAPTER LABEL</p>

## A short heading

A little context beside the live app.

- Reveal this deliberately. <!-- .element: class="fragment" -->

```

For the slide's position N in the deck, add a matching `## Slide N: A short heading` section to [demo.md](../demo.md) with its brief speaker bullets. Put detailed steps below a `## Demo N.1: Architecture Demo` heading. The app builds Reveal's speaker notes from those initial bullets; add/reorder the guide sections along with the slides. Missing/misnumbered sections fail explicitly.

Layouts:

- `title`: large opening typography.
- `content`: content-only slide.
- `split`: content on the left, live app on the right.
- `demo`: a short heading above a full-stage live app.

For `split` and `demo`, use `data-demo="explore"`, `"architecture"`, `"analytics"`, `"funding"`, or `"project"` (the real `/project/1` document route for SSR). Demo slides do **not** automatically select checkpoints. The dropdown is deliberately manual, so you can jump backward without fighting slide actions.

`data-checkpoint` selects a slide's fallback image, not its live Docker stack. Chapter slides can set the same attribute for the image checkpoint shown on subsequent content-only slides.

Start with checkpoint **00**. Transition notes identify where to switch to **01** through **06** while explaining the next chapter. The durable restart demo is different: stay on **03** and restart the same Postgres instance and volume. Never use a checkpoint switch or reset as the continuity proof.

Use a stage-oriented widescreen display. On small screens the stage scales to fit; the app's own responsive layout and scrolling remain usable.

## Presentation controls

- **Left/Right**, **Space**, or footer arrows: previous/next slide or reveal.
- **O** or **Overview**: jump between slides.
- **S** or **Notes**: separate speaker window, defaulting to **Tall** (current/next previews stacked beside the notes). Layout choices are remembered separately from Reveal's old speaker window. Allow the popup.
- Speaker view shows only the **clock** and **elapsed presentation timer**, with an optional reset. The upcoming preview immediately tracks the next whole slide, not the next fragment/reveal; the final slide shows an end-of-presentation placeholder.
- Speaker arrows and keyboard navigation control the main deck. Previews are read-only and do not start extra Docker polling or load extra live app iframes. Speaker view requires serving the site, not opening the HTML through `file://`. Reopen Notes after reloading the main presentation.
- **F** or **Fullscreen**: fullscreen presentation.
- Bookmark hashes such as `#/architecture`; refresh returns to that slide.
- After interacting with the iframe, click **Back to slides** in its toolbar to return keyboard focus to the deck. Keyboard events inside a cross-origin iframe belong to the app; the footer arrows always remain available.
- **Reload** refreshes the iframe. **Open app** opens the same route in its own tab.

Essential assets, including fonts, are bundled locally. Reduced-motion preferences disable slide/reveal transitions.

The Microsoft wordmark in the intro and persistent speaker-credit footer, plus the intro's [Cagliari Calcio crest](https://cagliaricalcio.com/wp-content/themes/cagliari-theme/img/favicon/android-chrome-192x192.png), are bundled in `public/logos/`, not loaded from third-party sites during presentation. The Microsoft SVG adapts the [vector wordmark](https://commons.wikimedia.org/wiki/File:Microsoft_logo_(2012).svg) with white lettering and a transparent background, retaining the letter shapes, proportions, and four colored squares. Both marks belong to their respective owners.

If VS Code's integrated browser blocks the speaker popup, use the presentation URL in a regular browser.

## Build a standalone deck

```sh
npm test
npm run build
npm run preview
```

Publish only `dist/`, including `demo-images/`, `api-specs/`, and its generated `third-party-licenses.txt` for Reveal.js, Swagger UI, and the bundled fonts. Relative asset paths support project-site hosting such as `/<repository>/`. The production build defaults to captured images/schemas, disables live Docker/API requests, and never contacts localhost. Speaker notes and all other published content must be safe to share.

`npm start` is local presenter mode; `npm run preview` is a preview of the public, static deck. After dependencies/images are prepared, local presentation and checkpoint switching need no conference network connection.

## GitHub Pages

The public deck is at **<https://btholt.github.io/postgres-talk-delete-your-backend/>**.

The [Pages workflow](../.github/workflows/pages.yml) runs on every push to `main` and can also be started manually from the repository's Actions tab. It uses the Node version in `.nvmrc`, installs the locked slide dependencies with `npm ci`, runs `npm test`, builds the deck, and deploys only `slides/dist/`. The captured images, schemas, logos, fonts, and license notices are included. Docker, databases, and live services are never started or deployed.

For initial setup or a fork, open **Settings -> Pages -> Build and deployment -> Source** in GitHub and select **GitHub Actions**. No deployment key or custom repository secret is needed; deployment uses the workflow's scoped `GITHUB_TOKEN` and GitHub Pages environment. Git/SSH access alone cannot change that repository setting.

Subsequent successful pushes publish automatically. A failed test or build leaves the existing site in place; deployment runs are serialized so an in-progress publication is not interrupted.
