import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { routes } from '../src/demo-url.js';
import { checkpoints } from '../presenter/checkpoints.js';
import { withPresenterNotes } from '../src/presenter-guide.js';

const markdown = withPresenterNotes(
  readFileSync(new URL('../deck.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../../demo.md', import.meta.url), 'utf8'),
);
const slides = markdown.trim().split(/\r?\n---\r?\n/).map(source => {
  const [content, notes, ...extra] = source.split(/^Notes:\s*$/m);
  const attributes = Object.fromEntries([...content.matchAll(/([\w-]+)="([^"]*)"/g)]
    .map(([, name, value]) => [name, value]));
  const visible = content.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ').replace(/&[\w#]+;/g, ' ').trim();
  return { content, notes, extra, attributes, visible };
});

test('the 31-slide talk has unique stable URLs, valid layouts, and supported iframe routes', () => {
  assert.equal(slides.length, 31);
  const ids = slides.map(slide => slide.attributes.id);
  assert.equal(new Set(ids).size, slides.length);
  for (const { attributes } of slides) {
    assert.match(attributes.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(['title', 'content', 'split', 'demo'].includes(attributes['data-layout']));
    if (['split', 'demo'].includes(attributes['data-layout'])) {
      assert.ok(Object.hasOwn(routes, attributes['data-demo']), attributes.id);
      assert.ok(checkpoints.some(checkpoint => checkpoint.id === attributes['data-checkpoint']), `${attributes.id}: fallback image checkpoint required`);
    } else {
      assert.equal(attributes['data-demo'], undefined, attributes.id);
    }
  }
});

test('feature chapters embed the original app and its replacement beside the matching SQL', () => {
  for (const [id, route, checkpoint] of [
    ['search', 'explore', '00'],
    ['query-plan', 'explore', '01'],
    ['vectors', 'explore', '01'],
    ['similarity', 'explore', '02'],
    ['plumbing', 'funding', '02'],
    ['restart', 'funding', '03'],
    ['warehouse', 'analytics', '03'],
    ['analytics', 'analytics', '04'],
  ]) {
    const slide = slides.find(slide => slide.attributes.id === id);
    assert.equal(slide.attributes['data-demo'], route, `${id}: matching app view`);
    assert.equal(slide.attributes['data-checkpoint'], checkpoint, `${id}: before/after checkpoint`);
  }
  const search = slides.find(slide => slide.attributes.id === 'query-plan');
  assert.match(search.attributes['data-sql'], /02-search-projects\.sql 03-show-search-index\.sql/);
});

test('speaker notes are brief topic/demo bullets without per-slide pacing', () => {
  for (const { attributes, notes, extra } of slides) {
    assert.ok(notes, `${attributes.id}: notes missing`);
    assert.equal(extra.length, 0, `${attributes.id}: multiple notes sections`);
    const lines = notes.trim().split('\n').filter(line => line.trim());
    assert.ok(lines.every(line => /^\s*- /.test(line)), `${attributes.id}: notes must be bullets`);
    assert.ok(lines.length <= 10, `${attributes.id}: too many note bullets`);
    assert.ok(lines.every(line => line.trim().split(/\s+/).length <= 30), `${attributes.id}: long note bullet`);
    assert.equal(attributes['data-timing'], undefined, `${attributes.id}: no per-slide pacing metadata`);
    assert.doesNotMatch(notes, /\*\*Time:|\d+:\d{2}|\*\*Demo \(/, `${attributes.id}: notes should not contain pacing reminders`);
  }
});

test('audience copy stays sparse and speaker/demo instructions stay in notes', () => {
  for (const { attributes, content, visible } of slides) {
    assert.match(content, /^##? /m, `${attributes.id}: heading missing`);
    assert.ok(visible.split(/\s+/).length <= 80, `${attributes.id}: too much audience copy`);
    assert.doesNotMatch(content, /\*\*Time:|\*\*Demo \(/, attributes.id);
  }
  assert.doesNotMatch(markdown, /\u2014/, 'No em dashes in slide copy or notes');
});

test('DiskANN stays a footnote outside closing resources and the SSR demo uses the real project route', () => {
  const mentions = slides.filter(slide => slide.attributes.id !== 'closing' && /DiskANN/.test(slide.content));
  assert.equal(mentions.length, 1);
  assert.match(mentions[0].content, /class="footnote".*https:\/\/github.com\/microsoft\/DiskANN/);
  assert.doesNotMatch(markdown, /pgvectorscale|Timescale/);
  assert.equal(slides.find(slide => slide.attributes.id === 'render').attributes['data-demo'], 'project');
});

test('opening and closing slides show the shareable talk URL', () => {
  for (const id of ['opening', 'closing']) {
    const slide = slides.find(slide => slide.attributes.id === id);
    assert.match(slide.content, /<a\b[^>]*href="https:\/\/holt\.fyi\/dyb"[^>]*>holt\.fyi\/dyb<\/a>/, `${id}: missing talk short link`);
  }
});

test('closing slide includes the requested project and speaker profile links', () => {
  const closing = slides.find(slide => slide.attributes.id === 'closing');
  for (const url of [
    'https://github.com/btholt/postgres-talk-delete-your-backend',
    'https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-pgsql',
    'https://pghacker-mcp.dev/',
    'https://github.com/pgvector/pgvector',
    'https://github.com/microsoft/DiskANN',
    'https://github.com/microsoft/pg_durable',
    'https://twitter.com/holtbt',
    'https://www.linkedin.com/in/btholt',
  ]) {
    assert.ok(closing.content.includes(`href="${url}"`), `Missing closing resource: ${url}`);
  }
});

test('intro logos are local, preserve their aspect ratios, and have appropriate text alternatives', () => {
  const intro = slides.find(slide => slide.attributes.id === 'brian');
  const images = [...intro.content.matchAll(/<img\b[^>]*>/g)].map(([image]) => image);
  assert.equal(images.length, 2);
  for (const image of images) {
    const source = image.match(/src="(\.\/logos\/[^"]+)"/)?.[1];
    assert.ok(source, 'Intro logos must use subpath-safe local URLs');
    const asset = readFileSync(new URL(`../public/${source.slice(2)}`, import.meta.url));
    const width = Number(image.match(/width="(\d+)"/)?.[1]);
    const height = Number(image.match(/height="(\d+)"/)?.[1]);
    assert.ok(width > 0 && height > 0, 'Explicit image dimensions are required');
    if (source.endsWith('.svg')) {
      const svg = asset.toString();
      const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      assert.ok(viewBox, 'SVG must have intrinsic proportions');
      assert.ok(Math.abs(width * Number(viewBox[2]) - height * Number(viewBox[1])) < 1e-8);
      assert.match(svg, /<path fill="#fff"/);
      assert.equal([...svg.matchAll(/<rect\b/g)].length, 4, 'Only the four colored squares have rectangles');
      assert.doesNotMatch(svg, /<image\b/, 'Wordmark must be vector, not an embedded raster image');
    } else {
      assert.equal(asset.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(width * asset.readUInt32BE(20), height * asset.readUInt32BE(16));
    }
    assert.match(image, source.includes('microsoft-wordmark') ? /alt="Microsoft"/ : /alt=""/);
  }
  assert.match(intro.content, /Would rather be snowboarding\. Sports fan\./);
});
