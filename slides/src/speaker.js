import './speaker.css';
import { speakerNamespace } from './speaker-notes.js';

const currentFrame = document.querySelector('#current-frame');
const nextFrame = document.querySelector('#next-frame');
const errorBox = document.querySelector('#speaker-error');
const layout = document.querySelector('#layout');
const storageKey = 'delete-your-backend-speaker-layout';
const layouts = ['tall', 'default', 'wide', 'notes-only'];
let state;
let opener;

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function send(type) {
  if (!opener || opener.closed) {
    showError('Open Notes from the presentation window to connect this speaker view.');
    return;
  }
  opener.postMessage({ namespace: speakerNamespace, type }, window.location.origin);
}

try {
  const saved = localStorage.getItem(storageKey);
  layout.value = layouts.includes(saved) ? saved : 'tall';
} catch (error) {
  showError(`Layout preferences could not be read: ${error.message}`);
}
document.body.dataset.layout = layout.value;
layout.addEventListener('change', () => {
  document.body.dataset.layout = layout.value;
  try { localStorage.setItem(storageKey, layout.value); }
  catch (error) { showError(`Layout preference could not be saved: ${error.message}`); }
});

function previewUrl(role) {
  const url = new URL(state.url);
  url.searchParams.delete('notes');
  url.searchParams.set('receiver', '1');
  url.searchParams.set('speaker-preview', role);
  url.hash = '';
  return url.href;
}

function updatePreview(frame, previewState) {
  if (!previewState) return;
  frame.contentWindow.postMessage({ namespace: speakerNamespace, type: 'preview-state', state: previewState, demo: state.demo }, window.location.origin);
}

function updatePreviews() {
  if (!state) return;
  updatePreview(currentFrame, state.current);
  updatePreview(nextFrame, state.next);
}

window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.data?.namespace !== speakerNamespace) return;
  if ([currentFrame.contentWindow, nextFrame.contentWindow].includes(event.source) && event.data.type === 'preview-ready') {
    updatePreviews();
    return;
  }
  if (event.source !== opener || event.data.type !== 'state') return;
  state = event.data;
  const modeButton = document.querySelector('#demo-mode-switch');
  modeButton.hidden = !state.demo?.canUseLive;
  modeButton.textContent = state.demo?.mode === 'images' ? 'Use live demos' : 'Use images';
  modeButton.setAttribute('aria-pressed', String(state.demo?.mode === 'images'));
  document.querySelector('#current-number').textContent = `${state.number} / ${state.total}`;
  document.querySelector('#next-number').textContent = state.next ? `${state.number + 1} / ${state.total}` : '';
  document.querySelector('#notes').innerHTML = state.notes;
  nextFrame.hidden = !state.next;
  document.querySelector('#end-of-deck').hidden = Boolean(state.next);
  for (const [frame, role] of [[currentFrame, 'current'], [nextFrame, 'next']]) {
    const url = previewUrl(role);
    if (frame.getAttribute('src') !== url) frame.src = url;
  }
  updatePreviews();
});

document.querySelector('#previous').addEventListener('click', () => send('previous'));
document.querySelector('#next').addEventListener('click', () => send('next'));
document.querySelector('#reset-timer').addEventListener('click', () => send('reset-timer'));
document.querySelector('#demo-mode-switch').addEventListener('click', () => send('toggle-demo-mode'));
window.addEventListener('keydown', event => {
  if (event.target.closest('select, input, textarea, [contenteditable="true"]')) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault();
    send(event.shiftKey && event.key === ' ' ? 'previous' : 'next');
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    send('previous');
  }
});

function updateClock() {
  const now = new Date();
  document.querySelector('#clock').textContent = now.toLocaleTimeString();
  if (state) {
    const seconds = Math.max(0, Math.floor((now.getTime() - state.startedAt) / 1000));
    document.querySelector('#elapsed').textContent = [
      Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60,
    ].map(value => String(value).padStart(2, '0')).join(':');
  }
}
updateClock();
setInterval(updateClock, 1000);

try {
  if (window.opener?.location.origin === window.location.origin) opener = window.opener;
} catch (error) {
  showError(`Speaker view requires a same-origin presentation: ${error.message}`);
}
send('ready');
