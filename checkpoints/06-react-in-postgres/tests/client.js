import { createHmac } from 'node:crypto';
import { demoToken } from '../frontend/src/demo-session.js';
export const base = process.env.BASE_URL || 'http://localhost:3000';
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => originalFetch(new URL(url, base), options);
export { api } from '../frontend/src/api-client.js';
export const actorA = '11111111-1111-4111-8111-111111111111';
export const actorB = '22222222-2222-4222-8222-222222222222';
export function token(sub = actorB, role = 'web_user', extra = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role, aud: 'kickstopper', ...extra })}`;
  return `${body}.${createHmac('sha256', 'kickstopper-local-demo-jwt-secret-not-for-production').update(body).digest('base64url')}`;
}
export async function http(path, { method = 'GET', body, key, authorization = demoToken, headers = {} } = {}) {
  const response = await originalFetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authorization === null ? {} : { Authorization: `Bearer ${authorization}` }),
      ...(key ? { 'Idempotency-Key': key } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}
export async function until(load, check, label) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const value = await load();
    if (check(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
