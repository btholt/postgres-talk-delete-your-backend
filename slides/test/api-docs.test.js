import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { apiCheckpoints, apiDocsUrl, prepareSpec, readOnlyRequest } from '../src/api-docs-config.js';

test('only generated-API checkpoints have local API explorer links', () => {
  assert.equal(apiDocsUrl('05', true), './api-docs.html?checkpoint=05&source=live');
  assert.equal(apiDocsUrl('06', false), './api-docs.html?checkpoint=06&source=snapshot');
  assert.throws(() => apiDocsUrl('04', true), /05 and 06/);
});

test('the generated schema is preserved except for the fixed local transport address', () => {
  const original = { swagger: '2.0', host: 'localhost:3000', basePath: '/api', paths: { '/projects': { get: {} } } };
  const spec = prepareSpec(original);
  assert.equal(spec.host, '127.0.0.1:3000');
  assert.equal(spec.basePath, '/api');
  assert.deepEqual(spec.paths, original.paths);
  assert.equal(original.host, 'localhost:3000');
  assert.throws(() => prepareSpec({ openapi: '3.0' }), /Swagger 2.0/);
});

test('Try it out only permits anonymous local GET requests and never runs captured schemas', () => {
  const request = {
    url: 'http://127.0.0.1:3000/api/projects?id=eq.1&select=id,name', method: 'GET',
    headers: { Authorization: 'not-a-real-token', Accept: 'application/json' },
  };
  const safe = readOnlyRequest(request, true);
  assert.deepEqual(safe.headers, { Accept: 'application/json' });
  assert.equal(safe.credentials, 'omit');
  assert.throws(() => readOnlyRequest(request, false), /Captured schemas/);
  for (const overrides of [
    { method: 'POST' }, { method: 'PATCH' }, { method: 'DELETE' },
    { url: 'https://example.com/api/projects' },
    { url: 'http://127.0.0.1:3000/api/rpc/expire_demo' },
    { url: 'http://127.0.0.1:3000/api/projects/other' },
    { url: 'http://user:password@127.0.0.1:3000/api/projects' },
  ]) {
    assert.throws(() => readOnlyRequest({ ...request, ...overrides }, true), /anonymous GET/);
  }
});

test('both checkpoints have a real bundled schema with project filters', () => {
  for (const id of apiCheckpoints) {
    const spec = JSON.parse(readFileSync(new URL(`../public/api-specs/${id}.json`, import.meta.url), 'utf8'));
    assert.equal(prepareSpec(spec).swagger, '2.0');
    const filters = spec.paths['/projects'].get.parameters.map(parameter => parameter.$ref);
    assert.ok(filters.includes('#/parameters/rowFilter.projects.id'));
    assert.ok(filters.includes('#/parameters/select'));
  }
});
