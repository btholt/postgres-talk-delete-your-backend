import SwaggerUI from 'swagger-ui-dist/swagger-ui-bundle.js';
import 'swagger-ui-dist/swagger-ui.css';
import './api-docs.css';
import { apiCheckpoints, apiRoot, prepareSpec, readOnlyRequest } from './api-docs-config.js';

const parameters = new URLSearchParams(location.search);
const checkpoint = parameters.get('checkpoint') || '05';
const live = import.meta.env.DEV && parameters.get('source') !== 'snapshot';
const checkpointSelect = document.querySelector('#api-checkpoint');
const sourceSelect = document.querySelector('#api-source');
const status = document.querySelector('#api-status');
sourceSelect.value = live ? 'live' : 'snapshot';
sourceSelect.querySelector('[value="live"]').disabled = !import.meta.env.DEV;
checkpointSelect.value = checkpoint;

function changeSource() {
  const url = new URL(location.href);
  url.searchParams.set('checkpoint', checkpointSelect.value);
  url.searchParams.set('source', sourceSelect.value);
  url.hash = '';
  location.assign(url.href);
}
checkpointSelect.addEventListener('change', changeSource);
sourceSelect.addEventListener('change', changeSource);
document.querySelector('#api-reload').addEventListener('click', () => location.reload());

async function json(url, headers = {}) {
  const response = await fetch(url, {
    headers, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`API request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function start() {
  if (!apiCheckpoints.includes(checkpoint)) throw new Error('Choose checkpoint 05 or 06.');
  let spec;
  if (live) {
    const health = await json(`${apiRoot}/rpc/health`);
    if (!health.checkpoint?.startsWith(`${checkpoint}-`)) {
      throw new Error(`Checkpoint ${checkpoint} is selected, but the running API reports "${health.checkpoint}". Change the real checkpoint in the presentation, or select the running checkpoint here.`);
    }
    spec = await json(`${apiRoot}/`, { Accept: 'application/openapi+json' });
    status.textContent = `LIVE / CHECKPOINT ${checkpoint} / Real generated schema and read-only requests.`;
  } else {
    spec = await json(`./api-specs/${checkpoint}.json`);
    status.textContent = `CAPTURED SCHEMA / CHECKPOINT ${checkpoint} / Offline documentation. Try it out is disabled; no live API requests.`;
  }
  SwaggerUI({
    dom_id: '#swagger-ui',
    spec: prepareSpec(spec),
    presets: [SwaggerUI.presets.apis],
    deepLinking: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    supportedSubmitMethods: live ? ['get'] : [],
    requestInterceptor: request => readOnlyRequest(request, live),
    validatorUrl: null,
    queryConfigEnabled: false,
    withCredentials: false,
    persistAuthorization: false,
  });
}

start().catch(error => {
  status.textContent = 'API documentation could not be loaded.';
  const box = document.querySelector('#api-error');
  box.textContent = `${error.message} Select Captured schema to browse the prepared offline description.`;
  box.hidden = false;
});
