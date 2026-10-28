import { mkdir, writeFile } from 'node:fs/promises';
import { createController } from '../presenter/controller.js';
import { checkpoints } from '../presenter/checkpoints.js';
import { routes } from '../src/demo-url.js';
import { openBrowser } from './browser.mjs';

if (!process.argv.includes('--allow-checkpoint-switches')) {
  throw new Error('Capture temporarily switches Docker checkpoints. Confirm with --allow-checkpoint-switches. No resets or demo writes are performed.');
}

const controller = createController();
const initial = await controller.status();
if (!initial.ready || initial.busy) throw new Error('Start exactly one healthy checkpoint before capturing images.');
const original = initial.current;
const output = new URL('../public/demo-images/', import.meta.url);
const capturedAt = new Date().toISOString();
const images = [];
let browser;

async function switchTo(id) {
  controller.switchTo(id);
  await controller.settled();
  const status = await controller.status();
  if (!status.ready || status.current !== id || status.operation?.error) {
    throw new Error(status.operation?.log || `Checkpoint ${id} is not healthy.`);
  }
}

try {
  browser = await openBrowser();
  const page = await browser.newPage('about:blank');
  await browser.command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  }, page);
  for (const checkpoint of checkpoints) {
    console.log(`Starting capture for checkpoint ${checkpoint.id}...`);
    await switchTo(checkpoint.id);
    await mkdir(new URL(`${checkpoint.id}/`, output), { recursive: true });
    for (const route of Object.keys(routes)) {
      const path = route === 'project' && checkpoint.id !== '06' ? '/#project/1' : routes[route];
      const url = new URL(path, 'http://127.0.0.1:3000');
      url.searchParams.set('capture', `${capturedAt}-${checkpoint.id}-${route}`);
      await browser.command('Page.navigate', { url: url.href }, page);
      await browser.wait(page, `document.querySelector('.checkpoint-badge')?.textContent.includes('CHECKPOINT ${checkpoint.id}') && document.querySelector('.page') && !document.querySelector('.loading')`);
      await browser.evaluate(page, 'document.fonts.ready.then(() => true)');
      if (route === 'architecture') {
        await browser.wait(page, `document.querySelector('.demo-state') && !document.querySelector('.demo-state').textContent.includes('loading')`);
        const nodes = await browser.evaluate(page, `document.querySelectorAll('.architecture-node').length`);
        const expected = [8, 6, 5, 3, 2, 2, 1][Number(checkpoint.id)];
        if (nodes !== expected) throw new Error(`Checkpoint ${checkpoint.id} diagram has ${nodes} nodes; expected ${expected}.`);
      }
      const errors = await browser.evaluate(page, `[...document.querySelectorAll('.error-box')].map(element => element.textContent)`);
      if (errors.length) throw new Error(`Cannot capture an error screen: ${errors.join('; ')}`);
      await browser.evaluate(page, `(() => { const style = document.createElement('style'); style.textContent = '* { animation: none !important; transition: none !important; caret-color: transparent !important; }'; document.head.append(style); })()`);
      const metrics = await browser.command('Page.getLayoutMetrics', {}, page);
      const width = Math.ceil(metrics.cssContentSize.width);
      const height = Math.ceil(metrics.cssContentSize.height);
      const screenshot = await browser.command('Page.captureScreenshot', {
        format: 'webp', quality: 90, captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height, scale: 1 },
      }, page);
      const src = `${checkpoint.id}/${route}.webp`;
      await writeFile(new URL(src, output), Buffer.from(screenshot.data, 'base64'));
      images.push({ checkpoint: checkpoint.id, route, src, width, height });
      console.log(`Captured ${src} (${width}x${height}).`);
    }
  }
  await writeFile(new URL('manifest.json', output), JSON.stringify({ capturedAt, images }, null, 2) + '\n');
} finally {
  console.log(`Restoring checkpoint ${original}...`);
  try { await switchTo(original); }
  finally { await browser?.close(); }
}
console.log(`Captured ${images.length} read-only screenshots; checkpoint ${original} restored.`);
