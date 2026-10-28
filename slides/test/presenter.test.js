import assert from 'node:assert/strict';
import { createServer, get } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { createController, parseInventory } from '../presenter/controller.js';
import { checkpoints } from '../presenter/checkpoints.js';
import { createPresenterMiddleware } from '../presenter/middleware.js';

function inventory(id, health = 'healthy') {
  const checkpoint = checkpoints.find(item => item.id === id);
  return Array.from({ length: checkpoint.containers }, () =>
    `kickstopper-${checkpoint.directory}\trunning\tUp 1 minute (${health})`).join('\n');
}

function fakeRuntime({ current = '06', missingImages = false, failStart = null, restoreFails = false } = {}) {
  const calls = [];
  const run = async (command, args, options = {}) => {
    calls.push([command.endsWith('/scripts/demo') ? 'demo' : command, ...args]);
    if (args[0] === 'ps') return current ? inventory(current) : '';
    if (args[0] === 'compose') return 'prepared-image:local\n';
    if (args[0] === 'image' && missingImages) throw new Error('Image not found');
    if (args[0] === 'stop') { current = null; return ''; }
    if (args[0] === 'start') {
      if (args[1] === failStart || (restoreFails && args[1] === '06')) throw new Error('Health check failed');
      current = args[1];
      options.onOutput?.('All services healthy\n');
    }
    return '';
  };
  return { run, calls };
}

test('inventory ignores unrelated stacks and requires the complete healthy service inventory', () => {
  assert.deepEqual(parseInventory(`${inventory('06')}\nother-project\trunning\tUp (healthy)`), [{ id: '06', ready: true }]);
  assert.deepEqual(parseInventory(inventory('06', 'unhealthy')), [{ id: '06', ready: false }]);
  assert.deepEqual(parseInventory(inventory('06').split('\n')[0]), [{ id: '06', ready: false }]);
  assert.equal(parseInventory(`${inventory('05')}\n${inventory('06')}`).length, 2);
});

test('switches in either direction, preflights before stopping, and never resets data', async () => {
  const runtime = fakeRuntime();
  const controller = createController(runtime);
  controller.switchTo('05');
  assert.throws(() => controller.switchTo('04'), /already in progress/);
  await controller.settled();
  assert.equal((await controller.status()).current, '05');
  controller.switchTo('06');
  await controller.settled();
  assert.equal((await controller.status()).current, '06');
  assert.deepEqual(runtime.calls.filter(call => call[0] === 'demo'), [
    ['demo', 'stop', '06'], ['demo', 'start', '05'],
    ['demo', 'stop', '05'], ['demo', 'start', '06'],
  ]);
  assert.ok(runtime.calls.findIndex(call => call[1] === 'image') <
    runtime.calls.findIndex(call => call[1] === 'stop'));
});

test('an unprepared checkpoint leaves the current stack untouched with an actionable error', async () => {
  const runtime = fakeRuntime({ missingImages: true });
  const controller = createController(runtime);
  controller.switchTo('00');
  await controller.settled();
  const status = await controller.status();
  assert.equal(status.current, '06');
  assert.equal(status.operation.phase, 'failed');
  assert.match(status.operation.log, /prepare 00/);
  assert.equal(runtime.calls.filter(call => call[0] === 'demo').length, 0);
});

test('a failed startup restores the previous checkpoint and still reports failure', async () => {
  const controller = createController(fakeRuntime({ failStart: '05' }));
  controller.switchTo('05');
  await controller.settled();
  const status = await controller.status();
  assert.equal(status.current, '06');
  assert.equal(status.ready, true);
  assert.equal(status.operation.phase, 'failed');
  assert.match(status.operation.error, /Health check failed/);
  assert.match(status.operation.log, /requested switch still failed/);
});

test('a failed restore is explicit, and invalid checkpoints never run commands', async () => {
  const runtime = fakeRuntime({ failStart: '05', restoreFails: true });
  const controller = createController(runtime);
  assert.throws(() => controller.switchTo('reset'), /00 through 06/);
  assert.equal(runtime.calls.length, 0);
  controller.switchTo('05');
  await controller.settled();
  assert.match((await controller.status()).operation.error, /also failed/);
});

test('selecting the already healthy checkpoint is a no-op', async () => {
  const runtime = fakeRuntime();
  const controller = createController(runtime);
  controller.switchTo('06');
  await controller.settled();
  assert.equal((await controller.status()).operation.phase, 'complete');
  assert.equal(runtime.calls.filter(call => call[0] === 'demo').length, 0);
});

test('local HTTP control requires a token, loopback host, same-origin POST, and valid input', async t => {
  const controller = createController(fakeRuntime());
  const server = createServer(createPresenterMiddleware({ controller, token: 'test-token' }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'X-Presenter-Token': 'test-token', 'Content-Type': 'application/json', Origin: base };
  assert.equal((await fetch(`${base}/status`)).status, 403);
  const reboundHostStatus = await new Promise((resolve, reject) => {
    get(`${base}/status`, { headers: { ...headers, Host: 'attacker.example' } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    }).on('error', reject);
  });
  assert.equal(reboundHostStatus, 403);
  assert.equal((await fetch(`${base}/status`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/checkpoint`, {
    method: 'POST', headers: { ...headers, Origin: 'https://attacker.example' }, body: '{"checkpoint":"05"}',
  })).status, 403);
  for (const body of ['null', '{}', '{"checkpoint":"reset"}', '{invalid']) {
    assert.equal((await fetch(`${base}/checkpoint`, { method: 'POST', headers, body })).status, 400);
  }
  assert.equal((await fetch(`${base}/checkpoint`, { method: 'POST', headers, body: '{"checkpoint":"05"}' })).status, 202);
  await controller.settled();
  assert.equal((await controller.status()).current, '05');
  assert.equal((await fetch(`${base}/reset`, { method: 'POST', headers, body: '{}' })).status, 404);
});
