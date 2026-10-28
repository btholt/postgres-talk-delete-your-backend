import assert from 'node:assert/strict';
import test from 'node:test';
import { demoUrl } from '../src/demo-url.js';

test('demo URLs retain the app route and bypass cached HTML across checkpoint switches and reloads', () => {
  const before = new URL(demoUrl('architecture', '05', 100));
  const after = new URL(demoUrl('architecture', '06', 101));
  assert.equal(after.origin, 'http://127.0.0.1:3000');
  assert.equal(after.pathname, '/');
  assert.equal(after.hash, '#architecture');
  assert.equal(after.searchParams.get('presenter_checkpoint'), '06');
  assert.notEqual(before.href, after.href);
  assert.notEqual(after.href, demoUrl('architecture', '06', 102));
  assert.equal(after.href, demoUrl('architecture', '06', 101));
});

test('unknown demo routes fail explicitly instead of embedding an arbitrary URL', () => {
  assert.throws(() => demoUrl('https://example.com', '06', 1), /Unknown demo route/);
});

test('the SSR demo opens the server-rendered Honk project rather than a client-side hash route', () => {
  const url = new URL(demoUrl('project', '06', 1));
  assert.equal(url.pathname, '/project/1');
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('presenter_checkpoint'), '06');
});
