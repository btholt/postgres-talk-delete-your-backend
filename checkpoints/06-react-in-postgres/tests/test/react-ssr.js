import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { base } from '../client.js';

const compose = fileURLToPath(new URL('../../compose.yaml', import.meta.url));
const database = process.env.DATABASE_URL || 'postgresql://kickstopper:kickstopper-local@localhost:54320/kickstopper';
const bootstrap = html => JSON.parse(html.match(/<script type="application\/json" id="kickstopper-data">([\s\S]*?)<\/script>/)[1]);

test('real React SSR and native HTTP preserve the public product without a frontend host', async t => {
  const client = new pg.Client({ connectionString: database });
  await client.connect();
  const original = (await client.query('SELECT name,pledged_cents,backers_count FROM public.projects WHERE id=1')).rows[0];
  try {
    await t.test('the renderer is plv8 with a restricted owner and read-only public inputs', async () => {
      const { rows: [routine] } = await client.query(`
        SELECT l.lanname,r.rolname,r.rolsuper,r.rolcanlogin,p.prosecdef
        FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles r ON r.oid=p.proowner
        WHERE p.oid='public.render_page(integer)'::regprocedure`);
      assert.deepEqual(routine, { lanname: 'plv8', rolname: 'web_renderer', rolsuper: false, rolcanlogin: false, prosecdef: true });
      assert.equal((await client.query("SELECT pg_has_role('api_authenticator','web_renderer','MEMBER') AS allowed")).rows[0].allowed, false);
      await client.query('BEGIN READ ONLY');
      try {
        const { rows: [{ html }] } = await client.query('SELECT public.render_page(1) AS html');
        assert.ok(html.startsWith('<!doctype html>'));
        assert.ok(html.includes('Back this questionable idea'));
        assert.equal(bootstrap(html).resources['/projects/1'].name, original.name);
      } finally { await client.query('ROLLBACK'); }
      for (const sql of ['SELECT * FROM public.funding_requests', 'SELECT embedding FROM public.projects', 'UPDATE public.projects SET name=name']) {
        await client.query('BEGIN; SET LOCAL ROLE web_renderer');
        try { await assert.rejects(client.query(sql), { code: '42501' }); }
        finally { await client.query('ROLLBACK'); }
      }
    });
    await t.test('native HTTP serves fresh complete HTML and exact locally built asset bytes', async () => {
      for (const path of ['/', '/project/1']) {
        const response = await fetch(`${base}${path}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /^text\/html/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const html = await response.text();
        const data = bootstrap(html);
        assert.equal(data.route, path === '/' ? 'explore' : 'project/1');
        assert.ok(html.includes('Honk'));
        assert.ok(!html.includes('<!--kickstopper-ssr-->'));
        assert.ok(!JSON.stringify(data).includes('owner_id'));
        assert.ok(!JSON.stringify(data).includes('embedding'));
        if (path === '/') assert.equal(data.resources['/projects?q=&category='].projects.length, 8);
      }
      const assets = (await client.query('SELECT * FROM internal.web_assets')).rows;
      assert.ok(assets.some(asset => asset.path.endsWith('.js')));
      assert.ok(assets.some(asset => asset.path.endsWith('.css')));
      for (const asset of assets) {
        const response = await fetch(`${base}${asset.path}`);
        assert.equal(response.status, 200);
        assert.ok(response.headers.get('content-type').startsWith(asset.content_type));
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), asset.content);
      }
      assert.equal((await fetch(`${base}/project/999999999`)).status, 404);
      assert.equal((await fetch(`${base}/project/999999999999999999999`)).status, 404);
      assert.equal((await fetch(`${base}/missing.js`)).status, 404);
      assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
    });
    await t.test('live SQL values reach React markup and bootstrap JSON without HTML/script injection', async () => {
      const name = 'Real React $& <script>alert("no")</script> & quotes \u2028 \u2029';
      await client.query('UPDATE public.projects SET name=$1 WHERE id=1', [name]);
      const response = await fetch(`${base}/project/1`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes('&lt;script&gt;'));
      assert.ok(html.includes('\\u003cscript\\u003e'));
      assert.ok(!html.includes('<script>alert'));
      assert.ok(html.includes('$&amp;'));
      assert.equal(bootstrap(html).resources['/projects/1'].name, name);
      assert.equal((html.match(/<script\b/g) || []).length, 2);
      const result = await client.query('SELECT public.render_page(1) AS html');
      assert.equal(bootstrap(result.rows[0].html).resources['/projects/1'].name, name);
    });
    await t.test('the no-Intl plv8 build formats integer USD cents and counts exactly like the browser', async () => {
      for (const cents of [0, 1, 10, 99, 100, 101, 123450, 1875050, 2147483647]) {
        await client.query('UPDATE public.projects SET pledged_cents=$1,backers_count=1234567 WHERE id=1', [cents]);
        const { rows: [{ html }] } = await client.query('SELECT public.render_page(1) AS html');
        const expected = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
          minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
        assert.ok(html.includes(`<h2>${expected}</h2>`), `Incorrect SSR money at ${cents} cents.`);
        assert.ok(html.includes('<strong>1,234,567</strong>'));
      }
    });
    await t.test('requests do not reuse another page data and runtime inventory is honest', async () => {
      const pages = await Promise.all([2, 3, 4, 5, 6, 7, 8].map(async id => {
        const response = await fetch(`${base}/project/${id}`);
        assert.equal(response.status, 200);
        return [id, bootstrap(await response.text())];
      }));
      for (const [id, data] of pages) {
        assert.equal(data.route, `project/${id}`);
        assert.deepEqual(Object.keys(data.resources), [`/projects/${id}`]);
        assert.equal(data.resources[`/projects/${id}`].id, id);
      }
      const services = execFileSync('docker', ['compose', '-f', compose, 'config', '--services'], { encoding: 'utf8' }).trim().split('\n').sort();
      assert.deepEqual(services, ['api', 'postgres']);
      const containers = execFileSync('docker', ['compose', '-f', compose, 'ps', '--format', 'json'], { encoding: 'utf8' }).trim().split('\n').map(line => JSON.parse(line));
      assert.equal(containers.length, 2);
      assert.ok(containers.find(container => container.Service === 'postgres').Publishers.some(port => port.PublishedPort === 3000 && port.TargetPort === 8080));
    });
  } finally {
    await client.query('UPDATE public.projects SET name=$1,pledged_cents=$2,backers_count=$3 WHERE id=1',
      [original.name, original.pledged_cents, original.backers_count]);
    await client.end();
  }
});
