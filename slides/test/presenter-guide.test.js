import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readPresenterGuide, withPresenterNotes } from '../src/presenter-guide.js';

const guide = readFileSync(new URL('../../demo.md', import.meta.url), 'utf8');
const deck = readFileSync(new URL('../deck.md', import.meta.url), 'utf8');

test('one authoritative guide section matches each slide title and all slides have speaking points', () => {
  const sections = readPresenterGuide(guide);
  const slides = deck.trim().split(/\r?\n---\r?\n/);
  assert.equal(sections.length, 31);
  assert.equal(sections.length, slides.length);
  const words = text => text.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
  for (const [index, section] of sections.entries()) {
    const title = slides[index].match(/^#{1,2} (.+)$/m)?.[1];
    assert.ok(title, `Slide ${index + 1}: title missing`);
    assert.equal(words(section.title), words(title), `Guide title does not match slide ${index + 1}`);
    assert.ok(section.notes.startsWith('- '));
    assert.doesNotMatch(section.notes, /```|^##/m, 'Detailed demos must not replace the brief speaker bullets');
  }
  assert.doesNotMatch(deck, /^Notes:/m, 'The deck must not keep a second editable copy of speaker notes');
});

test('big Demo N.M headings stay beneath their slide and use consecutive demo numbers', () => {
  const sections = readPresenterGuide(guide);
  let count = 0;
  for (const section of sections) {
    const demos = [...section.body.matchAll(/^## Demo (\d+)\.(\d+): (.+)$/gm)];
    demos.forEach(([, slide, demo, title], index) => {
      assert.equal(Number(slide), section.number);
      assert.equal(Number(demo), index + 1);
      assert.ok(title.trim());
      count++;
    });
  }
  assert.ok(count >= 20, 'The guide should include the explicit app, SQL, restart, research, and API demos');
  assert.match(guide, /^## Slide 7: Postgres\. Meet Your Editor$/m);
  assert.match(guide, /^## Demo 7\.1: VS Code Demo$/m);
});

test('feature walkthroughs are interleaved with their replacement SQL, not front-loaded into the opening', () => {
  const sections = readPresenterGuide(guide);
  const opening = sections[2].body;
  assert.match(opening, /Back this questionable idea/);
  assert.doesNotMatch(opening, /sourdough|Find my kind of weird|Request funding|Open \*\*Analytics/);

  for (const { before, after, action, original, replacement, query } of [
    { before: 6, after: 8, action: 'sourdough', original: 'Meilisearch', replacement: 'Postgres full-text search', query: '03-show-search-index.sql' },
    { before: 10, after: 11, action: 'Less busywork, fewer meetings', original: 'Qdrant', replacement: 'pgvector', query: '08-find-similar-projects.sql' },
    { before: 12, after: 14, action: 'Request funding', original: 'queue', replacement: 'pg_durable', query: '10-select-durable-instance.sql' },
    { before: 16, after: 17, action: 'Analytics', original: 'ClickHouse', replacement: 'pg_duckdb', query: '14-explain-duckdb-analytics.sql' },
  ]) {
    const baseline = sections[before - 1].body;
    const replaced = sections[after - 1].body;
    assert.ok(baseline.includes(`## Demo ${before}.1:`), `Slide ${before}: original app demo missing`);
    for (const text of [action, original]) assert.ok(baseline.includes(text), `Slide ${before}: ${text} missing`);
    for (const text of [action, replacement, `](./sql/${query})`]) assert.ok(replaced.includes(text), `Slide ${after}: ${text} missing`);
    assert.ok(baseline.indexOf(action) < baseline.indexOf('switch **'), `Slide ${before}: use the feature before switching`);
  }
});

test('the React finale starts with execution and preserves the rename/restore proof without a code tour', () => {
  const render = readPresenterGuide(guide)[25];
  assert.match(render.body, /^## Demo 26\.1: Execute React and Open the Project$/m);
  assert.match(render.body, /```sql\s+SELECT render_page\(1\);\s+```/);
  assert.match(render.body, /http:\/\/localhost:3000\/project\/1/);
  assert.deepEqual(
    [...render.body.matchAll(/\]\(\.\/sql\/([^)]+)\)/g)].map(([, filename]) => filename),
    ['20-render-project.sql', '21-rename-project.sql', '22-restore-project-name.sql'],
  );
  assert.doesNotMatch(render.body, /17-select-project|18-select-react-code|19-show-render-function|pg_proc|pg_get_functiondef/);
});

test('only the initial speaking bullets become Reveal notes, not the detailed demo walkthrough', () => {
  const notes = readPresenterGuide(`# Guide

## Slide 1: Hello

- Speak about the premise.
- **Demo:** show the app.

## Demo 1.1: App

Run the app.

\`\`\`sql
SELECT 1;
\`\`\`

## Slide 2: Goodbye

- Take questions.

### Resources

- Public link.
`);
  assert.equal(notes[0].notes, '- Speak about the premise.\n- **Demo:** show the app.');
  assert.equal(notes[1].notes, '- Take questions.');
  const compiled = withPresenterNotes('# Hello\n\n---\n\n# Goodbye', '## Slide 1: Hello\n\n- First.\n\n## Slide 2: Goodbye\n\n- Last.');
  assert.match(compiled, /# Hello\n\nNotes:\n- First\./);
  assert.match(compiled, /# Goodbye\n\nNotes:\n- Last\./);
});

test('missing, repeated, misnumbered, or duplicate-source notes fail explicitly', () => {
  assert.throws(() => readPresenterGuide('# No slide notes'), /numbered Slide headings/);
  assert.throws(() => readPresenterGuide('## Slide 2: Wrong start\n\n- Topic.'), /expected Slide 1/);
  assert.throws(() => readPresenterGuide('## Slide 1: One\n\n- Topic.\n\n## Slide 1: Again\n\n- Topic.'), /expected Slide 2/);
  assert.throws(() => readPresenterGuide('## Slide 1: Missing bullets\n\nA paragraph.'), /speaker-note bullets/);
  assert.throws(() => withPresenterNotes('# One\n\nNotes:\n- Duplicate.', '## Slide 1: One\n\n- Topic.'), /Edit speaker notes in demo.md/);
  assert.throws(() => withPresenterNotes('# One\n\n---\n\n# Two', '## Slide 1: One\n\n- Topic.'), /one Slide section/);
});
