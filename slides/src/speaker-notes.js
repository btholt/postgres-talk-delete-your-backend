export const speakerNamespace = 'delete-your-backend-speaker';

export function speakerState(deck, startedAt, url) {
  const slides = deck.getSlides();
  const current = deck.getCurrentSlide();
  const index = slides.indexOf(current);
  const next = slides[index + 1];
  const nextIndices = next ? deck.getIndices(next) : null;
  return {
    current: deck.getState(),
    next: nextIndices ? { indexh: nextIndices.h, indexv: nextIndices.v, indexf: -1, paused: false, overview: false } : null,
    number: index + 1,
    total: slides.length,
    notes: deck.getSlideNotes() || '',
    url,
    startedAt,
  };
}

export function createSpeakerNotes({ onError, getDemoSettings, onToggleDemoMode }) {
  let deck;
  let speaker;
  let startedAt;
  const events = ['slidechanged', 'fragmentshown', 'fragmenthidden', 'paused', 'resumed', 'overviewshown', 'overviewhidden'];
  const publish = () => {
    if (speaker && !speaker.closed) {
      speaker.postMessage({ namespace: speakerNamespace, type: 'state', ...speakerState(deck, startedAt, window.location.href), demo: getDemoSettings?.() }, window.location.origin);
    }
  };
  const receive = event => {
    if (event.origin !== window.location.origin || event.source !== speaker || event.data?.namespace !== speakerNamespace) return;
    switch (event.data.type) {
      case 'ready': publish(); break;
      case 'next': deck.next(); break;
      case 'previous': deck.prev(); break;
      case 'reset-timer': startedAt = Date.now(); publish(); break;
      case 'toggle-demo-mode': onToggleDemoMode?.(); break;
    }
  };
  function open() {
    if (speaker && !speaker.closed) {
      speaker.focus();
      publish();
      return;
    }
    speaker = window.open(new URL('speaker.html', window.location.href).href, speakerNamespace, 'width=1200,height=900');
    if (!speaker) {
      onError('Speaker view was blocked. Allow popups for this presentation, then open Notes again.');
      return;
    }
    startedAt ??= Date.now();
  }
  return {
    id: 'notes',
    init(instance) {
      deck = instance;
      if (new URLSearchParams(window.location.search).has('speaker-preview')) return;
      window.addEventListener('message', receive);
      window.addEventListener('presentation-demo-change', publish);
      events.forEach(event => deck.on(event, publish));
      deck.addKeyBinding({ keyCode: 83, key: 'S', description: 'Speaker notes view' }, open);
    },
    open,
    destroy() {
      window.removeEventListener('message', receive);
      window.removeEventListener('presentation-demo-change', publish);
      events.forEach(event => deck.off(event, publish));
      deck.removeKeyBinding(83);
    },
  };
}

export function connectSpeakerPreview(deck, onDemoSettings) {
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== window.parent ||
      event.data?.namespace !== speakerNamespace || event.data.type !== 'preview-state') return;
    deck.setState(event.data.state);
    onDemoSettings?.(event.data.demo);
  });
  window.parent.postMessage({ namespace: speakerNamespace, type: 'preview-ready' }, window.location.origin);
}
