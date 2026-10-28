import express from 'express';
import { pool, transaction, recordEvent } from './database.js';
import { projectSummaries, searchProjects, similarProjects, warehouse } from './integrations.js';
import { HttpError, projectId, backingAmount, requestId, semanticQueries } from './domain.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb', inflate: false }));

app.get('/health', async (_request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ok', checkpoint: '02-vectors' });
});

app.get('/api/projects', async (request, response) => {
  const q = String(request.query.q ?? '').trim();
  if (q.length > 160) throw new HttpError(400, 'Keep searches under 160 characters.');
  const summary = await projectSummaries();
  let projects = summary.projects;
  let source = 'Postgres + UNLOGGED cache';
  if (q) {
    const hits = await searchProjects(q);
    const byId = new Map(projects.map(project => [project.id, project]));
    projects = hits.map(hit => byId.get(hit.id)).filter(Boolean);
    source = 'Postgres full-text search + UNLOGGED cache';
  }
  if (request.query.category) projects = projects.filter(project => project.category === request.query.category);
  response.set('X-Cache', summary.cache).json({ projects, source, cache: summary.cache });
});

app.get('/api/semantic-queries', (_request, response) => {
  response.json(semanticQueries.map(({ id, label }) => ({ id, label })));
});

app.get('/api/similar', async (request, response) => {
  const summary = await projectSummaries();
  let vector;
  let exclude;
  if (request.query.projectId) {
    exclude = projectId(request.query.projectId);
    const { rows } = await pool.query('SELECT embedding::text::jsonb AS embedding FROM projects WHERE id=$1', [exclude]);
    if (!rows.length) throw new HttpError(404, 'Project not found.');
    vector = rows[0].embedding;
  } else {
    const preset = semanticQueries.find(query => query.id === request.query.query);
    if (!preset) throw new HttpError(400, 'Choose one of the prepared idea matches. No live AI service is used.');
    vector = preset.vector;
  }
  const result = await similarProjects(vector, exclude);
  response.json({
    projects: result.map(point => ({
      ...summary.projects.find(project => project.id === point.id), similarity: point.similarity,
    })),
    source: 'Postgres + pgvector · prepared vectors, no inference',
  });
});

app.get('/api/projects/:id', async (request, response) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id=$1', [projectId(request.params.id)]);
  if (!rows.length) throw new HttpError(404, 'Project not found.');
  const { embedding, search_document, ...project } = rows[0];
  response.json(project);
});

app.post('/api/projects/:id/back', async (request, response) => {
  const id = projectId(request.params.id);
  const amount = backingAmount(request.body?.amount_cents);
  const key = requestId(request.get('Idempotency-Key'));
  const result = await transaction(async client => {
    const existing = await client.query('SELECT * FROM backings WHERE id=$1', [key]);
    if (existing.rows.length) {
      const backing = existing.rows[0];
      if (backing.project_id !== id || backing.amount_cents !== amount) throw new HttpError(409, 'This idempotency key was already used for a different backing.');
      return backing;
    }
    const { rows } = await client.query('SELECT * FROM projects WHERE id=$1 FOR UPDATE', [id]);
    const project = rows[0];
    if (!project) throw new HttpError(404, 'Project not found.');
    if (project.status === 'expired' || new Date(project.deadline) <= new Date()) throw new HttpError(409, 'This campaign has ended.');
    // The unique ID also guards concurrent retries that reached the row lock together.
    const inserted = await client.query('INSERT INTO backings (id, project_id, amount_cents) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *', [key, id, amount]);
    if (!inserted.rows.length) {
      const replay = await client.query('SELECT * FROM backings WHERE id=$1', [key]);
      if (replay.rows[0].project_id !== id || replay.rows[0].amount_cents !== amount) throw new HttpError(409, 'This idempotency key was already used for a different backing.');
      return replay.rows[0];
    }
    await client.query(`UPDATE projects SET pledged_cents=pledged_cents+$2, backers_count=backers_count+1,
      status=CASE WHEN pledged_cents+$2>=goal_cents THEN 'funded' ELSE status END WHERE id=$1`, [id, amount]);
    return inserted.rows[0];
  });
  response.status(201).json({ backing: result, message: 'You backed a questionable idea. No real money moved.' });
});

app.post('/api/projects/:id/funding', async (request, response) => {
  const id = projectId(request.params.id);
  const key = requestId(request.get('Idempotency-Key'));
  const result = await transaction(async client => {
    const { rows } = await client.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'Project not found.');
    const existing = await client.query('SELECT * FROM funding_requests WHERE project_id=$1 OR id=$2', [id, key]);
    if (existing.rows.length) {
      if (existing.rows[0].project_id !== id) throw new HttpError(409, 'This request key belongs to another project.');
      return existing.rows[0];
    }
    const inserted = await client.query('INSERT INTO funding_requests (id, project_id) VALUES ($1,$2) RETURNING *', [key, id]);
    await recordEvent(client, key, 'Funding request saved. Waiting for the queue worker.');
    await client.query("INSERT INTO outbox (request_id, kind) VALUES ($1,'check')", [key]);
    return inserted.rows[0];
  });
  response.status(202).json(result);
});

app.get('/api/funding', async (_request, response) => {
  const { rows } = await pool.query(`SELECT f.*, p.name, p.color FROM funding_requests f
    JOIN projects p ON p.id=f.project_id ORDER BY f.created_at DESC`);
  response.json(rows);
});

app.get('/api/funding/:id', async (request, response) => {
  const id = requestId(request.params.id);
  const { rows } = await pool.query('SELECT * FROM funding_requests WHERE id=$1', [id]);
  if (!rows.length) throw new HttpError(404, 'Funding request not found.');
  const events = await pool.query('SELECT message, created_at FROM workflow_events WHERE request_id=$1 ORDER BY id', [id]);
  response.json({ ...rows[0], events: events.rows });
});

app.post('/api/funding/:id/decision', async (request, response) => {
  const id = requestId(request.params.id);
  const decision = request.body?.decision;
  if (!['approve', 'reject'].includes(decision)) throw new HttpError(400, 'Choose approve or reject.');
  const result = await transaction(async client => {
    const { rows } = await client.query('SELECT * FROM funding_requests WHERE id=$1 FOR UPDATE', [id]);
    const funding = rows[0];
    if (!funding) throw new HttpError(404, 'Funding request not found.');
    if (funding.decision === decision) return funding;
    if (funding.status !== 'awaiting_approval') throw new HttpError(409, 'This request is not waiting for a decision.');
    const updated = await client.query("UPDATE funding_requests SET status='approval_queued', decision=$2, updated_at=now() WHERE id=$1 RETURNING *", [id, decision]);
    await recordEvent(client, id, `Human decision recorded: ${decision}. Waiting for the worker.`);
    await client.query("INSERT INTO outbox (request_id, kind) VALUES ($1,'decide')", [id]);
    return updated.rows[0];
  });
  response.status(202).json(result);
});

app.get('/api/analytics', async (_request, response) => {
  const [totals, daily, categories, refresh] = await Promise.all([
    warehouse(`SELECT sum(pledged_cents) AS pledged_cents, sum(backers_count) AS backers,
      count() AS projects, countIf(status='funded') AS funded, countIf(status='expired') AS expired FROM projects FINAL FORMAT JSON`),
    warehouse(`SELECT toString(toDate(created_at)) AS day, sum(amount_cents) AS amount_cents,
      count() AS backings FROM backings FINAL WHERE created_at >= today()-13 GROUP BY day ORDER BY day FORMAT JSON`),
    warehouse(`SELECT category, sum(pledged_cents) AS pledged_cents FROM projects FINAL GROUP BY category ORDER BY pledged_cents DESC FORMAT JSON`),
    warehouse('SELECT max(version) AS version FROM refreshes FINAL FORMAT JSON'),
  ]);
  response.json({ totals: totals[0], daily, categories, refreshed_at: Number(refresh[0].version), source: 'ClickHouse', refresh_interval_seconds: 5 });
});

app.post('/api/demo/expire', async (_request, response) => {
  await pool.query("UPDATE projects SET deadline=now() WHERE id=8 AND status='active'");
  response.status(202).json({ message: 'WalkBlock is now due. The scheduler will expire it on its next five-second tick.' });
});

app.use((_request, _response, next) => next(new HttpError(404, 'Endpoint not found.')));
app.use((error, _request, response, _next) => {
  console.error('API request failed:', error);
  const status = error.status ?? 503;
  response.status(status).json({ error: status < 500 ? error.message : 'A supporting service is unavailable. Check the checkpoint logs and retry.' });
});

const server = app.listen(3001, '0.0.0.0', () => console.log('Kickstopper API listening on :3001'));
process.on('SIGTERM', () => server.close(async () => {
  await pool.end();
}));
