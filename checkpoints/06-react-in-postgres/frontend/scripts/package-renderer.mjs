import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const quote = value => `'${value.replaceAll("'", "''")}'`;
const shell = await readFile('dist/index.html', 'utf8');
for (const marker of ['<!--kickstopper-ssr-->', '<!--kickstopper-bootstrap-->']) {
  if (shell.split(marker).length !== 2) throw new Error(`Expected exactly one ${marker} in the built HTML shell.`);
}
const bundle = await readFile('ssr-dist/react-ssr.js', 'utf8');
if (bundle.includes('$render06$')) throw new Error('Renderer contains the SQL delimiter.');
const statements = [
  `INSERT INTO internal.web_shell VALUES (true,${quote(shell)});`,
  `CREATE FUNCTION internal.load_react() RETURNS void LANGUAGE plv8 AS $render06$\n${bundle}\nglobalThis.KickstopperSSR=KickstopperSSR;\n$render06$;`,
  'ALTER FUNCTION internal.load_react() OWNER TO web_renderer;',
  'GRANT EXECUTE ON FUNCTION internal.load_react() TO web_renderer;',
];
const types = { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
async function assets(directory = '') {
  for (const entry of await readdir(join('dist', directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assets(path);
    else if (path !== 'index.html') {
      const extension = path.slice(path.lastIndexOf('.'));
      if (!types[extension]) throw new Error(`Unrecognized asset content type: ${path}`);
      const data = await readFile(join('dist', path));
      statements.push(`INSERT INTO internal.web_assets VALUES (${quote('/' + path)},${quote(types[extension])},decode('${data.toString('hex')}','hex'));`);
    }
  }
}
await assets();
await writeFile('ssr-dist/10-react-assets.sql', statements.join('\n'));
