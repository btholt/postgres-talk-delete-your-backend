import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const sqlRoot = new URL('sql/', root);
const files = readdirSync(sqlRoot).filter(name => name.endsWith('.sql')).sort();
const rehearsalFiles = ['17-select-project.sql', '18-select-react-code.sql', '19-show-render-function.sql'];
const stageFiles = files.filter(filename => !rehearsalFiles.includes(filename));
const guide = readFileSync(new URL('demo.md', root), 'utf8');
const deck = readFileSync(new URL('../deck.md', import.meta.url), 'utf8');
const normalize = sql => sql.replace(/^\s*--[^\n]*$/gm, '').replace(/\s+/g, ' ').trim();
const blocks = [...guide.matchAll(/```sql\r?\n([\s\S]*?)```/g)].map(([, sql]) => normalize(sql));

test('every stage query has the same full SQL and exact filename in the phone guide', () => {
  assert.equal(stageFiles.length, 20);
  for (const filename of stageFiles) {
    const sql = readFileSync(new URL(filename, sqlRoot), 'utf8');
    assert.ok(guide.includes(`](./sql/${filename})`), `Missing guide filename: ${filename}`);
    assert.ok(blocks.includes(normalize(sql)), `Guide SQL differs from ${filename}`);
  }
  for (const block of blocks) {
    assert.ok(stageFiles.some(filename => normalize(readFileSync(new URL(filename, sqlRoot), 'utf8')) === block),
      `A guide query has no stage file: ${block}`);
  }
});

test('speaker notes include every stage query but omit rehearsal-only queries', () => {
  const referenced = [...deck.matchAll(/data-sql="([^"]+)"/g)].flatMap(([, value]) => value.split(/\s+/));
  assert.deepEqual([...new Set(referenced)].sort(), stageFiles);
  for (const filename of referenced) {
    assert.ok(files.includes(filename), `Unknown speaker-note query: ${filename}`);
  }
});

test('queries identify checkpoints, keep analytics atomic, and isolate the only two product writes', () => {
  for (const filename of files) {
    const sql = readFileSync(new URL(filename, sqlRoot), 'utf8');
    const statement = normalize(sql);
    if (filename === '99-rollback.sql') {
      assert.match(sql, /^-- Any checkpoint \| Recovery only:/);
      assert.equal(statement, 'ROLLBACK;');
    } else {
      assert.match(sql, /^-- Checkpoint 0[1-6] \| (Read-only|WRITE)/, filename);
      if (filename.startsWith('14-')) {
        assert.match(statement, /^BEGIN READ ONLY; SET LOCAL duckdb\.force_execution = true; EXPLAIN /);
        assert.ok(statement.endsWith('COMMIT;'));
      } else {
        assert.equal(statement.split(';').filter(part => part.trim()).length, 1, filename);
        assert.match(statement, filename.startsWith('21-') || filename.startsWith('22-') ? /^UPDATE / : /^SELECT /);
      }
    }
  }
  assert.match(readFileSync(new URL('21-rename-project.sql', sqlRoot), 'utf8'), /WHERE id = 1 AND name = 'Honk'\s+RETURNING id, name;/);
  assert.match(readFileSync(new URL('22-restore-project-name.sql', sqlRoot), 'utf8'), /WHERE id = 1 AND name = 'Honk: now rendered in Postgres'\s+RETURNING id, name;/);
  const analytics = readFileSync(new URL('checkpoints/04-analytics/scripts/sql/05-analytics.sql', root), 'utf8');
  assert.equal(normalize(readFileSync(new URL('14-explain-duckdb-analytics.sql', sqlRoot), 'utf8')), normalize(analytics));
});
