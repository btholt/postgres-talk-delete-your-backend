import assert from 'node:assert/strict';
import test from 'node:test';
import { speakerState } from '../src/speaker-notes.js';

function fixture(index, fragment = -1) {
  const slides = [{ h: 0, v: 0 }, { h: 1, v: 0 }, { h: 1, v: 1 }, { h: 2, v: 0 }];
  return {
    getSlides: () => slides,
    getCurrentSlide: () => slides[index],
    getIndices: slide => slide,
    getState: () => ({ indexh: slides[index].h, indexv: slides[index].v, indexf: fragment }),
    getSlideNotes: () => '<ul><li>Topic reminder</li></ul>',
  };
}

test('upcoming is the next whole slide for forward, reverse, and jump navigation', () => {
  for (const index of [0, 1, 2, 1, 0, 2]) {
    const deck = fixture(index);
    const state = speakerState(deck, 123, 'http://localhost/talk/');
    const next = deck.getSlides()[index + 1];
    assert.equal(state.number, index + 1);
    assert.equal(state.next.indexh, next.h);
    assert.equal(state.next.indexv, next.v);
    assert.equal(state.next.indexf, -1);
    assert.equal(state.startedAt, 123);
  }
});

test('reveals affect the current preview only, not the upcoming slide', () => {
  for (const fragment of [-1, 0, 1, 2]) {
    const state = speakerState(fixture(1, fragment), 123, 'http://localhost/talk/');
    assert.equal(state.current.indexf, fragment);
    assert.deepEqual(state.next, { indexh: 1, indexv: 1, indexf: -1, paused: false, overview: false });
  }
});

test('the last slide has no upcoming preview and no per-slide timer data', () => {
  const state = speakerState(fixture(3), 123, 'http://localhost/talk/');
  assert.equal(state.next, null);
  assert.equal(state.number, state.total);
  assert.equal(state.notes, '<ul><li>Topic reminder</li></ul>');
  assert.equal(state.url, 'http://localhost/talk/');
  assert.equal(state.startedAt, 123);
  assert.equal(state.timing, undefined);
});
