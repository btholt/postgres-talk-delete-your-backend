import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const site = 'https://btholt.github.io/postgres-talk-delete-your-backend/';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)]
  .map(([, name, value]) => [name, value]));
const tags = (source, name) => [...source.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))]
  .map(([tag]) => attributes(tag));

function pngSize(name) {
  const image = readFileSync(new URL(`../public/${name}`, import.meta.url));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.subarray(12, 16).toString(), 'IHDR');
  return [image.readUInt32BE(16), image.readUInt32BE(20)];
}

test('every HTML entry point includes the same project-path-safe favicon set', () => {
  for (const page of ['index.html', 'speaker.html', 'api-docs.html']) {
    const source = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    const links = tags(source, 'link');
    for (const expected of [
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: './favicon-32.png' },
      { rel: 'icon', type: 'image/svg+xml', href: './favicon.svg' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: './apple-touch-icon.png' },
    ]) {
      assert.ok(links.some(link => Object.entries(expected).every(([key, value]) => link[key] === value)), `${page}: missing ${expected.href}`);
      readFileSync(new URL(`../public/${expected.href.slice(2)}`, import.meta.url));
    }
  }
});

test('favicon fallbacks and the social card are real PNGs with the declared dimensions', () => {
  assert.deepEqual(pngSize('favicon-32.png'), [32, 32]);
  assert.deepEqual(pngSize('apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(pngSize('social-card.png'), [1200, 630]);
  const icon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
  assert.match(icon, /viewBox="0 0 64 64"/);
  assert.doesNotMatch(icon, /(?:href|src)="https?:/);
});

test('share metadata is in the static HTML and uses absolute public URLs and matching copy', () => {
  const head = html.split('</head>')[0];
  const metaTags = tags(head, 'meta');
  const meta = key => {
    const matches = metaTags.filter(tag => (tag.property || tag.name) === key);
    assert.equal(matches.length, 1, `${key}: expected one static meta tag`);
    return matches[0].content;
  };
  assert.equal(tags(head, 'link').find(link => link.rel === 'canonical')?.href, site);
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:site_name'), 'Delete Your Backend');
  assert.equal(meta('og:url'), site);
  assert.equal(meta('og:title'), 'Delete Your Backend');
  assert.equal(meta('twitter:title'), meta('og:title'));
  assert.ok(meta('description').includes('Brian Holt'));
  assert.equal(meta('og:description'), meta('description'));
  assert.equal(meta('twitter:description'), meta('description'));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.equal(meta('twitter:creator'), '@holtbt');
  assert.equal(meta('og:image'), `${site}social-card.png`);
  assert.equal(meta('twitter:image'), meta('og:image'));
  assert.equal(meta('og:image:type'), 'image/png');
  assert.deepEqual([Number(meta('og:image:width')), Number(meta('og:image:height'))], pngSize('social-card.png'));
  assert.ok(meta('og:image:alt').includes('holt.fyi/dyb'));
  assert.equal(meta('twitter:image:alt'), meta('og:image:alt'));
});
