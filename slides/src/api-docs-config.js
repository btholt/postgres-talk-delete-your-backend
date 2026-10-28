export const apiRoot = 'http://127.0.0.1:3000/api';
export const apiCheckpoints = ['05', '06'];
const readPaths = new Set(['/api/', '/api/projects', '/api/semantic_queries', '/api/rpc/health']);

export function apiDocsUrl(checkpoint, live) {
  if (!apiCheckpoints.includes(checkpoint)) throw new Error('API documentation is available for checkpoints 05 and 06.');
  return `./api-docs.html?checkpoint=${checkpoint}&source=${live ? 'live' : 'snapshot'}`;
}

export function prepareSpec(spec) {
  if (!spec || spec.swagger !== '2.0' || !spec.paths?.['/projects']?.get) {
    throw new Error('Expected the PostgREST Swagger 2.0 description with GET /projects.');
  }
  const root = new URL(apiRoot);
  return { ...spec, host: root.host, basePath: root.pathname, schemes: [root.protocol.slice(0, -1)] };
}

export function readOnlyRequest(request, live) {
  if (!live) throw new Error('Captured schemas cannot execute requests. Use Live API with checkpoint 05 or 06 running.');
  const url = new URL(request.url);
  if (request.method?.toUpperCase() !== 'GET' || url.origin !== new URL(apiRoot).origin ||
    !readPaths.has(url.pathname) || url.username || url.password) {
    throw new Error('This explorer permits only anonymous GET requests to the local public API resources.');
  }
  return {
    ...request,
    credentials: 'omit',
    headers: Object.fromEntries(Object.entries(request.headers || {})
      .filter(([name]) => !['authorization', 'cookie'].includes(name.toLowerCase()))),
  };
}
