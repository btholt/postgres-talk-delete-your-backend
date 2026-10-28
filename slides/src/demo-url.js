export const routes = {
  explore: '/#explore',
  architecture: '/#architecture',
  analytics: '/#analytics',
  funding: '/#funding',
  project: '/project/1',
};

export function demoUrl(route, checkpoint, revision) {
  if (!Object.hasOwn(routes, route)) throw new Error(`Unknown demo route "${route}" in deck.md.`);
  const url = new URL(routes[route], 'http://127.0.0.1:3000');
  if (checkpoint) url.searchParams.set('presenter_checkpoint', checkpoint);
  url.searchParams.set('presenter_revision', String(revision));
  return url.href;
}
