import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';

const base = process.env.BASE_URL || 'http://localhost:3000';
async function request(path, { method = 'GET', body, key } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data, cache: response.headers.get('X-Cache') };
}
async function ok(path, options) {
  const result = await request(path, options);
  assert.ok(result.status < 300, `${path}: ${JSON.stringify(result)}`);
  return result.data;
}
async function until(load, matches, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const value = await load();
    if (matches(value)) return value;
    await setTimeout(150);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

test('checkpoint 00 product tour against real supporting services (mutates demo data)', async t => {
  await t.test('frontend is built and locally served', async () => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Kickstopper/);
    const compressed = await fetch(`${base}/api/projects/1/back`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
      body: gzipSync('{"amount_cents":2500}'),
    });
    assert.equal(compressed.status, 415, 'Compressed bodies are deliberately unsupported.');
  });
  await t.test('browse, Redis caching, and Meilisearch keyword search', async () => {
    const first = await ok('/projects');
    assert.equal(first.projects.length, 8);
    const cached = await request('/projects');
    assert.equal(cached.cache, 'hit');
    const found = await ok('/projects?q=sourdough');
    assert.equal(found.source, 'Meilisearch + Redis');
    assert.deepEqual(new Set(found.projects.map(project => project.id)), new Set([2, 7]));
    assert.equal((await ok('/projects?q=zzzznonexistent')).projects.length, 0);
    assert.equal((await ok('/projects?category=Food%20%26%20Drink')).projects.length, 2);
  });
  await t.test('Qdrant performs prepared semantic and project similarity search', async () => {
    assert.equal((await ok('/similar?query=meetings')).projects[0].id, 4);
    const bread = await ok('/similar?projectId=2');
    assert.equal(bread.projects[0].id, 7);
    assert.ok(!bread.projects.some(project => project.id === 2));
    assert.equal((await request('/similar?query=anything')).status, 400);
  });
  let initial;
  await t.test('fake backing is atomic, reflected in summaries, and idempotent under retries', async () => {
    initial = await ok('/projects/1');
    const key = randomUUID();
    const options = { method: 'POST', body: { amount_cents: 2500 }, key };
    await Promise.all([ok('/projects/1/back', options), ok('/projects/1/back', options)]);
    const updated = await ok('/projects/1');
    assert.equal(updated.pledged_cents, initial.pledged_cents + 2500);
    assert.equal(updated.backers_count, initial.backers_count + 1);
    assert.equal((await ok('/projects')).projects[0].pledged_cents, updated.pledged_cents);
    assert.equal((await request('/projects/1/back', { ...options, body: { amount_cents: 2600 } })).status, 409);
    assert.equal((await request('/projects/1/back', { ...options, body: { amount_cents: 499 }, key: randomUUID() })).status, 400);
    assert.equal((await request('/projects/1/back', { method: 'POST', body: {} })).status, 400);
  });
  await t.test('RabbitMQ worker checks funding, pauses for human approval, and records one fake grant', async () => {
    const key = randomUUID();
    const funding = await ok('/projects/1/funding', { method: 'POST', body: {}, key });
    assert.equal(funding.id, key, 'Use fresh demo data: reset before running this suite again.');
    await until(() => ok(`/funding/${key}`), result => result.status === 'awaiting_approval', 'funding eligibility');
    const pending = await ok(`/funding/${key}`);
    assert.equal(pending.risk_score, 32);
    await ok(`/funding/${key}/decision`, { method: 'POST', body: { decision: 'approve' } });
    const done = await until(() => ok(`/funding/${key}`), result => result.status === 'completed', 'approval');
    assert.equal(done.grant_cents, 250000);
    await ok(`/funding/${key}/decision`, { method: 'POST', body: { decision: 'approve' } });
    assert.equal((await ok(`/funding/${key}`)).events.length, done.events.length);
    assert.equal((await request(`/funding/${key}/decision`, { method: 'POST', body: { decision: 'reject' } })).status, 409);
  });
  await t.test('funding rejection and ineligibility take actual worker paths', async () => {
    const rejected = await ok('/projects/3/funding', { method: 'POST', body: {}, key: randomUUID() });
    await until(() => ok(`/funding/${rejected.id}`), result => result.status === 'awaiting_approval', 'second request');
    await ok(`/funding/${rejected.id}/decision`, { method: 'POST', body: { decision: 'reject' } });
    const done = await until(() => ok(`/funding/${rejected.id}`), result => result.status === 'rejected', 'rejection');
    assert.equal(done.grant_cents, 0);
    const ineligible = await ok('/projects/8/funding', { method: 'POST', body: {}, key: randomUUID() });
    await until(() => ok(`/funding/${ineligible.id}`), result => result.status === 'ineligible', 'ineligibility');
  });
  await t.test('scheduler expires unsuccessful campaigns and blocks new backing', async () => {
    await ok('/demo/expire', { method: 'POST', body: {} });
    await until(() => ok('/projects/8'), result => result.status === 'expired', 'campaign expiration');
    assert.equal((await request('/projects/8/back', { method: 'POST', body: { amount_cents: 1000 }, key: randomUUID() })).status, 409);
    assert.equal((await ok('/projects')).projects.find(project => project.id === 8).status, 'expired');
  });
  await t.test('ClickHouse replication includes the backing and expiration without duplicate aggregation', async () => {
    const analytics = await until(() => ok('/analytics'), result => Number(result.totals.expired) === 1, 'warehouse replication');
    assert.equal(analytics.source, 'ClickHouse');
    assert.equal(Number(analytics.totals.pledged_cents), 12384500);
    assert.equal(Number(analytics.totals.backers), 875);
    assert.equal(analytics.categories.length, 4);
    assert.ok(analytics.daily.length > 0);
    assert.ok(Date.now() - analytics.refreshed_at < 20000);
  });
});
