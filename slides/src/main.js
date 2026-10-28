import Reveal from 'reveal.js';
import Markdown from 'reveal.js/plugin/markdown';
import { createSpeakerNotes, connectSpeakerPreview } from './speaker-notes.js';
import 'reveal.js/reveal.css';
import './styles.css';
import markdown from '../deck.md?raw';
import presenterGuide from '../../demo.md?raw';
import { withPresenterNotes } from './presenter-guide.js';
import { checkpoints } from '../presenter/checkpoints.js';
import { demoUrl, routes } from './demo-url.js';
import { checkpointForSlide, imageUrl, initialDemoMode } from './demo-images.js';
import { apiCheckpoints, apiDocsUrl } from './api-docs-config.js';

const receiver = new URLSearchParams(location.search).has('speaker-preview');
const local = import.meta.env.DEV && !receiver;
if (receiver) document.body.classList.add('speaker-preview');
const token = document.querySelector('meta[name="presenter-token"]')?.content;
const select = document.querySelector('#checkpoint');
const modeSelect = document.querySelector('#demo-mode');
const connection = document.querySelector('#connection-status');
const statusPanel = document.querySelector('#controller-status');
const stage = document.querySelector('#stage');
let status = null;
let connectionError = '';
let actionError = '';
let submitting = false;
let requestedCheckpoint = '';
let timer;
let pollController;
let demoRevision = Date.now();
let imageOverride = null;
let previewLiveCheckpoint = null;
let mode = 'images';
const demoQueries = import.meta.glob('../../sql/*.sql', { query: '?raw', import: 'default', eager: true });
try {
  const requested = new URLSearchParams(location.search).get('demo');
  mode = initialDemoMode(local, requested, local && !requested ? localStorage.getItem('presentation-demo-mode') : null);
} catch (error) {
  showError(`Could not restore demo mode: ${error.message}. Using Images.`);
}

document.querySelector('#deck-source').textContent = withPresenterNotes(markdown, presenterGuide);
const deck = new Reveal({
  width: 1440,
  height: 810,
  margin: 0.045,
  hash: !receiver,
  hashOneBasedIndex: true,
  respondToHashChanges: !receiver,
  keyboard: !receiver,
  touch: !receiver,
  controls: false,
  progress: !receiver,
  center: false,
  scrollActivationWidth: 0,
  transition: receiver || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'fade',
  transitionSpeed: 'fast',
  plugins: [Markdown, createSpeakerNotes({
    onError: showError,
    getDemoSettings: () => ({
      mode,
      override: imageOverride?.slideId === deck.getCurrentSlide()?.id ? imageOverride : null,
      liveCheckpoint: status?.current,
      canUseLive: local,
    }),
    onToggleDemoMode: () => setDemoMode(mode === 'live' ? 'images' : 'live'),
  })],
});

function showError(message) {
  const box = document.querySelector('#presentation-error');
  box.textContent = message;
  box.hidden = !message;
}

function selectedImageCheckpoint(slide) {
  if (receiver && mode === 'live' && previewLiveCheckpoint) return previewLiveCheckpoint;
  return checkpointForSlide(deck.getSlides(), slide, imageOverride);
}

function notifyDemoChange() {
  window.dispatchEvent(new Event('presentation-demo-change'));
}

function setDemoMode(value) {
  if (!['live', 'images'].includes(value) || (value === 'live' && !local)) {
    showError('Live demos are available only in the local presenter app.');
    return;
  }
  mode = value;
  const url = new URL(location.href);
  url.searchParams.set('demo', mode);
  history.replaceState(null, '', url);
  imageOverride = null;
  clearTimeout(timer);
  pollController?.abort();
  try { localStorage.setItem('presentation-demo-mode', mode); }
  catch (error) { showError(`Could not remember demo mode: ${error.message}`); }
  renderStatus(true);
  notifyDemoChange();
  if (mode === 'live') poll();
}

function makeDemo(slide) {
  const route = slide.dataset.demo;
  const url = demoUrl(route, status?.current, demoRevision);
  const shell = document.createElement('div');
  shell.className = 'demo-shell';
  shell.innerHTML = `
    <div class="demo-toolbar">
      <span class="demo-address"><span class="live-dot"></span><span class="demo-source">127.0.0.1:3000</span><span class="demo-route"></span></span>
      <div>
        <button class="focus-slides" title="Return keyboard focus to the presentation">Back to slides</button>
        <button class="reload-demo" title="Reload the embedded app">Reload</button>
        <a class="open-api-docs" target="_blank" rel="noopener noreferrer" hidden>API docs &#8599;</a>
        <a class="open-demo" target="_blank" rel="noopener noreferrer">Open app &#8599;</a>
      </div>
    </div>
    <div class="demo-viewport">
      <div class="demo-placeholder"><span class="eyebrow">LIVE DEMO</span><h3></h3><p></p></div>
      <iframe allow="fullscreen" hidden></iframe>
      <div class="demo-image-viewport" hidden><img class="demo-image" alt="" /></div>
    </div>`;
  shell.querySelector('.demo-route').textContent = routes[route];
  shell.querySelector('.open-demo').href = url;
  shell.querySelector('iframe').title = `Kickstopper ${route} - interactive local demo`;
  const image = shell.querySelector('.demo-image');
  const imageError = () => {
    if (mode !== 'images' && !receiver) return;
    shell.querySelector('.demo-image-viewport').hidden = true;
    const placeholder = shell.querySelector('.demo-placeholder');
    placeholder.hidden = false;
    placeholder.querySelector('h3').textContent = 'The prepared image could not be loaded.';
    placeholder.querySelector('p').textContent = `Missing snapshot: ${image.getAttribute('src')}. Rebuild with the captured demo-images assets included.`;
  };
  image.addEventListener('error', imageError);
  shell.imageError = imageError;
  shell.querySelector('.focus-slides').addEventListener('click', () => stage.focus());
  shell.querySelector('.reload-demo').addEventListener('click', () => loadDemo(slide, true));
  slide.append(shell);
}

function loadDemo(slide, force = false) {
  if (!slide?.dataset.demo) return;
  const frame = slide.querySelector('iframe');
  const placeholder = slide.querySelector('.demo-placeholder');
  const shell = slide.querySelector('.demo-shell');
  const imageViewport = slide.querySelector('.demo-image-viewport');
  const image = slide.querySelector('.demo-image');
  const imageMode = mode === 'images' || receiver;
  const apiCheckpoint = imageMode ? selectedImageCheckpoint(slide) : status?.current;
  const apiDocs = slide.querySelector('.open-api-docs');
  apiDocs.hidden = !apiCheckpoints.includes(apiCheckpoint);
  if (!apiDocs.hidden) apiDocs.href = apiDocsUrl(apiCheckpoint, local && !imageMode);
  shell.classList.toggle('is-image', imageMode);
  imageViewport.hidden = !imageMode;
  slide.querySelector('.open-demo').hidden = false;
  if (imageMode) {
    frame.hidden = true;
    frame.removeAttribute('src');
    placeholder.hidden = true;
    const checkpoint = selectedImageCheckpoint(slide);
    const url = imageUrl(slide.dataset.demo, checkpoint);
    image.alt = `Captured Kickstopper ${slide.dataset.demo}, checkpoint ${checkpoint}. Snapshot, not live.`;
    slide.querySelector('.demo-source').textContent = `${receiver && mode === 'live' ? 'PREVIEW IMAGE' : 'IMAGE'} / CHECKPOINT ${checkpoint}`;
    slide.querySelector('.demo-route').textContent = ` / ${slide.dataset.demo}`;
    slide.querySelector('.open-demo').textContent = 'Open image \u2197';
    slide.querySelector('.open-demo').href = url;
    slide.querySelector('.reload-demo').textContent = 'Reload image';
    slide.querySelector('.reload-demo').disabled = false;
    if (force || image.getAttribute('src') !== url) {
      imageViewport.scrollTop = 0;
      image.src = url;
    } else if (image.complete && !image.naturalWidth) {
      shell.imageError();
    }
    return;
  }
  slide.querySelector('.demo-source').textContent = '127.0.0.1:3000';
  slide.querySelector('.demo-route').textContent = routes[slide.dataset.demo];
  slide.querySelector('.open-demo').textContent = 'Open app \u2197';
  slide.querySelector('.reload-demo').textContent = 'Reload';
  const available = local && status?.ready && !status.busy && !submitting && !connectionError;
  frame.hidden = !available;
  placeholder.hidden = available;
  slide.querySelector('.reload-demo').disabled = !available;
  if (available) {
    const url = demoUrl(slide.dataset.demo, status?.current, demoRevision);
    slide.querySelector('.open-demo').href = url;
    if (force || frame.getAttribute('src') !== url) frame.src = url;
  } else {
    frame.removeAttribute('src');
    placeholder.querySelector('h3').textContent = !local ? 'The live app lives on the presenter laptop.' :
      (status?.busy || submitting) ? 'Changing the architecture...' : 'The demo is not ready.';
    placeholder.querySelector('p').textContent = !local ?
      'Slides work on their own. For the interactive demo, run npm start in slides/ with prepared Docker checkpoints.' :
      connectionError || (status?.busy ? 'Waiting for the selected checkpoint to become healthy. Your data stays with its checkpoint.' :
        'Choose a prepared checkpoint above. Open the status panel below for details.');
  }
}

function refreshFrames(force = false) {
  // All checkpoints share a port; never reuse cached HTML from the previous stack.
  if (force) demoRevision += 1;
  const current = deck.getCurrentSlide();
  for (const slide of deck.getSlides()) {
    if (!slide.dataset.demo) continue;
    if (slide === current) loadDemo(slide, force);
    else if (mode === 'images' || receiver || force || !status?.ready || status?.busy || connectionError) {
      slide.querySelector('iframe').removeAttribute('src');
    }
  }
}

function updateSlide() {
  const slides = deck.getSlides();
  const slide = deck.getCurrentSlide();
  if (imageOverride?.slideId !== slide.id) imageOverride = null;
  document.querySelector('#slide-count').textContent = `${slides.indexOf(slide) + 1} / ${slides.length}`;
  document.querySelector('#presenter-previous').disabled = deck.isFirstSlide() && !deck.availableFragments().prev;
  document.querySelector('#presenter-next').disabled = deck.isLastSlide() && !deck.availableFragments().next;
  renderStatus();
}

function renderStatus(force = false) {
  modeSelect.value = mode;
  document.querySelector('#mode-label').textContent = mode === 'images' ? 'IMAGE MODE' : 'LOCAL PRESENTER';
  document.querySelector('label[for="checkpoint"]').textContent = mode === 'images' ? 'Image checkpoint' : 'Demo checkpoint';
  statusPanel.hidden = mode === 'images' || receiver;
  if (mode === 'images' || receiver) {
    select.disabled = false;
    select.value = selectedImageCheckpoint(deck.getCurrentSlide());
    select.title = 'Override the image on this slide only. This never changes Docker.';
    refreshFrames(force);
    return;
  }
  select.title = 'Switch the real running Docker checkpoint.';
  select.disabled = submitting || Boolean(status?.busy) || Boolean(connectionError);
  select.value = submitting ? requestedCheckpoint : status?.busy ? status.operation.target : status?.current || '';
  const operation = status?.operation;
  if (connectionError) connection.textContent = `Controller error: ${connectionError}`;
  else if (actionError) connection.textContent = `Checkpoint request failed: ${actionError}`;
  else if (status?.busy) connection.textContent = `Checkpoint ${operation.target}: ${operation.phase}...`;
  else if (operation?.phase === 'failed') connection.textContent = `Switch failed. ${status.ready ? `Checkpoint ${status.current} is running.` : 'Demo needs attention.'} Expand for details.`;
  else if (status?.ready) {
    const checkpoint = checkpoints.find(item => item.id === status.current);
    connection.textContent = `${checkpoint.id} / ${checkpoint.label} / ${checkpoint.containers} healthy containers`;
  } else if (status?.active.length > 1) connection.textContent = 'Multiple checkpoints are running. Choose one to stop the others.';
  else connection.textContent = 'No healthy demo. Choose a prepared checkpoint to start it.';
  statusPanel.classList.toggle('has-error', Boolean(connectionError || actionError || operation?.error));
  statusPanel.classList.toggle('is-busy', Boolean(status?.busy));
  document.querySelector('#controller-log').textContent = connectionError || actionError || operation?.log || connection.textContent;
  refreshFrames(force);
}

async function request(path, options = {}) {
  const response = await fetch(`/__presenter/${path}`, {
    ...options,
    headers: { 'X-Presenter-Token': token, ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Presenter request failed (${response.status}).`);
  return body;
}

async function poll() {
  clearTimeout(timer);
  if (!local || mode !== 'live') return;
  const controller = new AbortController();
  pollController = controller;
  try {
    const previous = status;
    status = await request('status', { signal: controller.signal });
    connectionError = '';
    if (status.ready && (previous?.current !== status.current || previous?.busy)) refreshFrames(true);
    if (previous?.current !== status.current) notifyDemoChange();
  } catch (error) {
    if (controller.signal.aborted) return;
    connectionError = error.message;
  }
  renderStatus();
  if (mode === 'live') timer = setTimeout(poll, status?.busy ? 1000 : 4000);
}

async function switchCheckpoint() {
  const target = select.value;
  if (!target) return;
  if (mode === 'images') {
    imageOverride = { slideId: deck.getCurrentSlide().id, checkpoint: target };
    renderStatus(true);
    notifyDemoChange();
    return;
  }
  clearTimeout(timer);
  requestedCheckpoint = target;
  actionError = '';
  submitting = true;
  renderStatus();
  refreshFrames(true);
  statusPanel.open = true;
  try {
    await request('checkpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoint: target }),
    });
    connectionError = '';
  } catch (error) {
    actionError = error.message;
  } finally {
    submitting = false;
  }
  await poll();
}

async function start() {
  await deck.initialize();
  for (const slide of deck.getSlides()) {
    const copy = document.createElement('div');
    copy.className = 'slide-copy';
    for (const child of [...slide.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE && child.matches('aside.notes')) continue;
      copy.append(child);
    }
    slide.prepend(copy);
    if (slide.dataset.demo) makeDemo(slide);
    for (const filename of (slide.dataset.sql || '').split(/\s+/).filter(Boolean)) {
      const sql = demoQueries[`../../sql/${filename}`];
      if (typeof sql !== 'string') throw new Error(`Missing speaker-note query: sql/${filename}`);
      const details = document.createElement('details');
      details.className = 'query-notes';
      const summary = document.createElement('summary');
      summary.textContent = `sql/${filename}`;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = sql;
      pre.append(code);
      details.append(summary, pre);
      slide.querySelector('aside.notes').append(details);
    }
  }
  deck.layout();
  new ResizeObserver(() => deck.layout()).observe(stage);
  deck.on('slidechanged', updateSlide);
  deck.on('fragmentshown', updateSlide);
  deck.on('fragmenthidden', updateSlide);
  document.querySelector('#presenter-previous').addEventListener('click', () => { deck.prev(); stage.focus(); });
  document.querySelector('#presenter-next').addEventListener('click', () => { deck.next(); stage.focus(); });
  document.querySelector('#overview').addEventListener('click', () => deck.toggleOverview());
  document.querySelector('#notes').addEventListener('click', () => deck.getPlugin('notes').open());
  document.querySelector('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) { showError(`Fullscreen unavailable: ${error.message}`); }
  });
  for (const checkpoint of checkpoints) {
    select.add(new Option(`${checkpoint.id} / ${checkpoint.label}`, checkpoint.id));
  }
  select.options[0].textContent = 'Choose a checkpoint';
  select.addEventListener('change', switchCheckpoint);
  modeSelect.querySelector('[value="live"]').disabled = !local;
  modeSelect.addEventListener('change', () => setDemoMode(modeSelect.value));
  if (local) {
    deck.addKeyBinding({ keyCode: 73, key: 'I', description: 'Toggle live/image demos' }, () => setDemoMode(mode === 'live' ? 'images' : 'live'));
    document.querySelector('#retry-connection').addEventListener('click', poll);
  }
  updateSlide();
  if (receiver) {
    connectSpeakerPreview(deck, settings => {
      if (!settings) return;
      mode = settings.mode;
      imageOverride = settings.override;
      previewLiveCheckpoint = settings.liveCheckpoint;
      renderStatus(true);
    });
  } else if (local && mode === 'live') {
    await poll();
  }
}

start().catch(error => showError(`Presentation failed to initialize: ${error.message}`));
