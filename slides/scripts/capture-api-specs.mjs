import { mkdir, writeFile } from 'node:fs/promises';
import { createController } from '../presenter/controller.js';
import { apiCheckpoints, apiRoot, prepareSpec } from '../src/api-docs-config.js';

if (!process.argv.includes('--allow-checkpoint-switches')) {
  throw new Error('Capture temporarily switches Docker checkpoints 05 and 06. Confirm with --allow-checkpoint-switches. No resets or demo writes are performed.');
}
const controller = createController();
const initial = await controller.status();
if (!initial.ready || initial.busy) throw new Error('Start exactly one healthy checkpoint before capturing API schemas.');
const root = new URL('../public/api-specs/', import.meta.url);
await mkdir(root, { recursive: true });

async function switchTo(id) {
  controller.switchTo(id);
  await controller.settled();
  const status = await controller.status();
  if (!status.ready || status.current !== id || status.operation?.error) {
    throw new Error(status.operation?.log || `Checkpoint ${id} is not healthy.`);
  }
}
async function json(path, headers = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    headers, credentials: 'omit', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Capture failed: HTTP ${response.status} on ${path}`);
  return response.json();
}
try {
  for (const id of apiCheckpoints) {
    await switchTo(id);
    const health = await json('/rpc/health');
    if (!health.checkpoint?.startsWith(`${id}-`)) throw new Error(`Checkpoint identity mismatch for ${id}.`);
    const spec = await json('/', { Accept: 'application/openapi+json' });
    prepareSpec(spec);
    await writeFile(new URL(`${id}.json`, root), JSON.stringify(spec, null, 2) + '\n');
    console.log(`Captured the real anonymous OpenAPI schema for ${health.checkpoint}.`);
  }
} finally {
  await switchTo(initial.current);
  console.log(`Restored checkpoint ${initial.current}; data preserved.`);
}
