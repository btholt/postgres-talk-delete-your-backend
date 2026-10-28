import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { backingAmount, projectId, requestId, assessFunding, semanticQueries } from '../src/domain.js';

test('backing validation accepts cents, enforces both boundaries, and refuses coercion', () => {
  assert.equal(backingAmount(500), 500);
  assert.equal(backingAmount(1000000), 1000000);
  for (const value of [499, 1000001, 0, -1, 12.5, '500', NaN, Infinity, null, undefined]) {
    assert.throws(() => backingAmount(value), { status: 400 });
  }
});

test('project IDs and idempotency keys reject unsafe input', () => {
  assert.equal(projectId('8'), 8);
  for (const value of ['1 OR true', 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => projectId(value), { status: 400 });
  }
  const id = randomUUID();
  assert.equal(requestId(id), id);
  for (const value of ['', 'not-a-key', 12, null]) assert.throws(() => requestId(value), { status: 400 });
});

test('funding rules enforce support and deadline, with deterministic capped fake grants', () => {
  const project = { id: 1, goal_cents: 1000000, pledged_cents: 200000, deadline: '2099-01-01', status: 'active' };
  assert.deepEqual(assessFunding(project), { eligible: true, riskScore: 32, grantCents: 100000 });
  assert.equal(assessFunding({ ...project, pledged_cents: 199999 }).eligible, false);
  assert.equal(assessFunding({ ...project, status: 'expired' }).eligible, false);
  assert.equal(assessFunding({ ...project, deadline: '2000-01-01' }).eligible, false);
  assert.equal(assessFunding({ ...project, goal_cents: 99999999 }).grantCents, 500000);
});

test('prepared semantic queries have stable unique IDs and compatible nonzero vectors', () => {
  assert.equal(new Set(semanticQueries.map(query => query.id)).size, 4);
  for (const { vector } of semanticQueries) {
    assert.equal(vector.length, 6);
    assert.ok(vector.every(Number.isFinite));
    assert.ok(vector.some(value => value > 0));
  }
});
