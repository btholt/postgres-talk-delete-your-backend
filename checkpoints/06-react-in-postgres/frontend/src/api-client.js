import { demoToken } from './demo-session.js';

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${demoToken}`, ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = data.code;
    if (data.code === 'PGRST116') {
      error.status = 404;
      error.message = 'Record not found or not visible to this demo identity.';
    }
    throw error;
  }
  return data;
}

export async function api(path, options = {}) {
  const url = new URL(path, 'http://kickstopper.local');
  const body = options.body === undefined ? {} : JSON.parse(options.body);
  const rpc = (name, args) => request(`/rpc/${name}`, {
    ...options, method: 'POST', body: JSON.stringify(args),
  });
  if (url.pathname === '/projects') {
    return rpc('project_summaries', { q: url.searchParams.get('q') || '', category: url.searchParams.get('category') || '' });
  }
  if (url.pathname === '/semantic-queries') {
    return request('/semantic_queries?select=id,label&order=ordinal', options);
  }
  if (url.pathname === '/similar') {
    return rpc('similar', {
      query_id: url.searchParams.get('query'),
      project_id: url.searchParams.has('projectId') ? Number(url.searchParams.get('projectId')) : null,
    });
  }
  if (url.pathname === '/analytics') return request('/rpc/analytics', options);
  if (url.pathname === '/health') return request('/rpc/health', options);
  if (url.pathname === '/funding') return request('/funding?order=created_at.desc', options);
  if (url.pathname === '/demo/expire') return rpc('expire_demo', {});
  const project = url.pathname.match(/^\/projects\/([^/]+)(?:\/(back|funding))?$/);
  if (project) {
    const id = project[1];
    if (project[2] === 'back') return rpc('back_project', { project_id: Number(id), amount_cents: body.amount_cents ?? null });
    if (project[2] === 'funding') return rpc('request_funding', { project_id: Number(id) });
    return request(`/projects?${new URLSearchParams({ id: `eq.${id}` })}`, {
      ...options, headers: { ...options.headers, Accept: 'application/vnd.pgrst.object+json' },
    });
  }
  const funding = url.pathname.match(/^\/funding\/([^/]+)(?:\/(decision))?$/);
  if (funding) {
    const id = funding[1];
    if (funding[2]) return rpc('decide_funding', { request_id: id, decision: body.decision ?? null });
    const [record, events] = await Promise.all([
      request(`/funding?${new URLSearchParams({
        id: `eq.${id}`,
        select: 'id,project_id,workflow_instance_id,eligible,status,risk_score,grant_cents,decision,created_at,updated_at,workflow_status',
      })}`, { ...options, headers: { ...options.headers, Accept: 'application/vnd.pgrst.object+json' } }),
      request(`/events?${new URLSearchParams({ request_id: `eq.${id}`, select: 'message,created_at', order: 'id' })}`, options),
    ]);
    return { ...record, events };
  }
  throw new Error(`Unknown client request: ${url.pathname}`);
}
