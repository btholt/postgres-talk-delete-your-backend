import { pool } from './database.js';

export async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${new URL(url).host}${new URL(url).pathname}: HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

export async function searchProjects(query) {
  const { rows } = await pool.query(`SELECT id FROM projects
    WHERE search_document @@ websearch_to_tsquery('english', $1)
    ORDER BY ts_rank(search_document, websearch_to_tsquery('english', $1)) DESC, id
    LIMIT 50`, [query]);
  return rows;
}

export function vectors(path, options = {}) {
  return jsonRequest(`${process.env.VECTOR_URL}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

export async function warehouse(sql, rows) {
  const url = new URL(process.env.ANALYTICS_URL);
  url.searchParams.set('database', 'kickstopper');
  if (rows) url.searchParams.set('query', sql);
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.ANALYTICS_USER}:${process.env.ANALYTICS_PASSWORD}`).toString('base64')}`,
    },
    body: rows ? rows.map(row => JSON.stringify(row)).join('\n') : sql,
  });
  if (!response.ok) throw new Error(`Warehouse HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const text = await response.text();
  return text.trim() ? JSON.parse(text).data : [];
}

export async function syncWarehouse() {
  const { rows: projects } = await pool.query('SELECT id, name, category, goal_cents, pledged_cents, backers_count, status FROM projects ORDER BY id');
  const { rows: backings } = await pool.query('SELECT id, project_id, amount_cents, created_at FROM backings ORDER BY id');
  const version = Date.now();
  await warehouse('INSERT INTO projects FORMAT JSONEachRow', projects.map(project => ({ ...project, version })));
  if (backings.length) {
    await warehouse('INSERT INTO backings FORMAT JSONEachRow', backings.map(backing => ({
      ...backing, created_at: backing.created_at.toISOString().slice(0, 19).replace('T', ' '),
    })));
  }
  await warehouse('INSERT INTO refreshes FORMAT JSONEachRow', [{ id: 1, version }]);
}

export async function projectSummaries() {
  const { rows } = await pool.query('SELECT * FROM project_summaries()');
  return rows[0];
}
