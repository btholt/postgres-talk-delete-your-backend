import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkpoints } from '../presenter/checkpoints.js';
import { routes } from '../src/demo-url.js';
import { checkpointForSlide, imageUrl, initialDemoMode } from '../src/demo-images.js';

test('image paths are local/subpath-safe and invalid routes or checkpoints fail explicitly', () => {
  assert.equal(imageUrl('architecture', '06'), './demo-images/06/architecture.webp');
  assert.throws(() => imageUrl('https://example.com', '00'), /Unknown image route/);
  assert.throws(() => imageUrl('explore', '../00'), /Unknown image checkpoint/);
});

test('slide checkpoints follow chapter markers; overrides affect the current slide only', () => {
  const slides = [
    { id: 'original', dataset: { checkpoint: '00' } },
    { id: 'intro', dataset: {} },
    { id: 'vectors', dataset: { checkpoint: '02' } },
    { id: 'similarity', dataset: {} },
    { id: 'workflows', dataset: { checkpoint: '03' } },
  ];
  assert.equal(checkpointForSlide(slides, slides[1]), '00');
  assert.equal(checkpointForSlide(slides, slides[3]), '02');
  const override = { slideId: 'similarity', checkpoint: '00' };
  assert.equal(checkpointForSlide(slides, slides[3], override), '00');
  assert.equal(checkpointForSlide(slides, slides[4], override), '03');
  assert.throws(() => checkpointForSlide(slides, { id: 'unknown' }), /outside this deck/);
});

test('static builds default to images; local mode supports explicit and saved preferences', () => {
  assert.equal(initialDemoMode(false, 'live', 'live'), 'images');
  assert.equal(initialDemoMode(true, null, null), 'live');
  assert.equal(initialDemoMode(true, null, 'images'), 'images');
  assert.equal(initialDemoMode(true, 'images', 'live'), 'images');
  assert.throws(() => initialDemoMode(true, 'invalid', null), /Unknown demo mode/);
});

test('all seven checkpoints have a real bundled image for every demo route', () => {
  const root = new URL('../public/demo-images/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  assert.ok(Number.isFinite(Date.parse(manifest.capturedAt)));
  assert.equal(manifest.images.length, checkpoints.length * Object.keys(routes).length);
  for (const checkpoint of checkpoints) {
    for (const route of Object.keys(routes)) {
      const capture = manifest.images.find(image => image.checkpoint === checkpoint.id && image.route === route);
      assert.ok(capture, `Missing ${checkpoint.id}/${route}`);
      const asset = readFileSync(new URL(capture.src, root));
      assert.equal(asset.subarray(0, 4).toString(), 'RIFF');
      assert.equal(asset.subarray(8, 12).toString(), 'WEBP');
      assert.ok(capture.width >= 1280 && capture.height >= 720, 'Snapshots must be presentation-sized');
    }
  }
});
