import { PresenterError } from './controller.js';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const localAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

async function readJson(request) {
  if (request.headers['content-type'] !== 'application/json') {
    throw new PresenterError('Expected application/json.', 415);
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 4096) throw new PresenterError('Request body is too large.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new PresenterError('Invalid JSON request.', 400);
  }
}

export function createPresenterMiddleware({ controller, token }) {
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, data) => {
      response.statusCode = status;
      response.end(JSON.stringify(data));
    };
    try {
      const host = request.headers.host;
      const url = new URL(request.url, `http://${host}`);
      if (!localHosts.has(url.hostname) || !localAddresses.has(request.socket.remoteAddress)) {
        throw new PresenterError('Presenter control is available only on loopback.', 403);
      }
      if (request.headers['x-presenter-token'] !== token) {
        throw new PresenterError('Invalid presenter token. Reload the local presentation.', 403);
      }
      if (request.method === 'GET' && url.pathname === '/status') {
        send(200, await controller.status());
      } else if (request.method === 'POST' && url.pathname === '/checkpoint') {
        if (request.headers.origin !== `http://${host}`) {
          throw new PresenterError('Checkpoint changes require a same-origin request.', 403);
        }
        const body = await readJson(request);
        if (!body || typeof body !== 'object' || typeof body.checkpoint !== 'string') {
          throw new PresenterError('A checkpoint string is required.', 400);
        }
        send(202, controller.switchTo(body.checkpoint));
      } else {
        throw new PresenterError('Unknown presenter endpoint or method.', 404);
      }
    } catch (error) {
      send(error instanceof PresenterError ? error.status : 500, { error: error.message });
    }
  };
}
