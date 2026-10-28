import { createClient } from 'redis';
import { pool } from './database.js';

export const cache = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
  socket: { connectTimeout: 5000, reconnectStrategy: retries => Math.min(250 * retries, 2000) },
});
cache.on('error', error => console.error('Redis error:', error.message));

export async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${new URL(url).host}${new URL(url).pathname}: HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

export function search(path, options = {}) {
  return jsonRequest(`${process.env.SEARCH_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SEARCH_KEY}`, ...options.headers },
  });
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
  const saved = await cache.get('projects:summary:v1');
  if (saved) return { projects: JSON.parse(saved), cache: 'hit' };
  const { rows } = await pool.query('SELECT id, name, tagline, category, founder, location, goal_cents, pledged_cents, backers_count, deadline, status, color FROM projects ORDER BY id');
  await cache.set('projects:summary:v1', JSON.stringify(rows), { EX: 20 });
  return { projects: rows, cache: 'miss' };
}

export async function invalidateProjects() {
  await cache.del('projects:summary:v1');
}
