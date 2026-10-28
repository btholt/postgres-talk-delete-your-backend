CREATE EXTENSION plv8 WITH VERSION '3.2.4';

CREATE ROLE web_renderer NOLOGIN;
GRANT web_anon TO web_renderer;
CREATE TABLE internal.web_shell (singleton boolean PRIMARY KEY CHECK (singleton), html text NOT NULL);
CREATE TABLE internal.web_assets (path text PRIMARY KEY, content_type text NOT NULL, content bytea NOT NULL);
GRANT SELECT ON internal.web_shell, internal.web_assets TO web_renderer;

CREATE FUNCTION public.render_page(project_id integer DEFAULT NULL) RETURNS text
LANGUAGE plv8 SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $render06$
  if (!globalThis.KickstopperSSR) plv8.find_function('internal.load_react')();
  const resources = {};
  const route = project_id === null ? 'explore' : 'project/' + project_id;
  if (project_id === null) {
    const rows = plv8.execute('SELECT row_to_json(p) AS data FROM api.projects p ORDER BY id');
    resources['/projects?q=&category='] = {
      projects: rows.map(row => row.data), source: 'Postgres - live React SSR'
    };
    resources['/semantic-queries'] = plv8.execute('SELECT id,label FROM api.semantic_queries ORDER BY ordinal');
  } else {
    const rows = plv8.execute('SELECT row_to_json(p) AS data FROM api.projects p WHERE id=$1', [project_id]);
    if (!rows.length) throw new Error('Project not found.');
    resources['/projects/' + project_id] = rows[0].data;
  }
  const bootstrap = { route, resources };
  const markup = globalThis.KickstopperSSR.render(bootstrap);
  const escaped = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' };
  const json = JSON.stringify(bootstrap).replace(/[<>&\u2028\u2029]/g, character => escaped[character]);
  const shell = plv8.execute('SELECT html FROM internal.web_shell WHERE singleton')[0].html;
  return shell.replace('<!--kickstopper-ssr-->', () => markup)
    .replace('<!--kickstopper-bootstrap-->', () => '<script type="application/json" id="kickstopper-data">' + json + '</script>');
$render06$;
ALTER FUNCTION public.render_page(integer) OWNER TO web_renderer;
REVOKE ALL ON FUNCTION public.render_page(integer) FROM PUBLIC;
