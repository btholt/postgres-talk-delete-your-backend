import { checkpoints } from '../presenter/checkpoints.js';
import { routes } from './demo-url.js';

export function imageUrl(route, checkpoint) {
  if (!Object.hasOwn(routes, route)) throw new Error(`Unknown image route "${route}".`);
  if (!checkpoints.some(item => item.id === checkpoint)) throw new Error(`Unknown image checkpoint "${checkpoint}".`);
  return `./demo-images/${checkpoint}/${route}.webp`;
}

export function checkpointForSlide(slides, slide, override) {
  if (override?.slideId === slide.id) return override.checkpoint;
  const index = slides.indexOf(slide);
  if (index < 0) throw new Error('Cannot select an image for a slide outside this deck.');
  for (let i = index; i >= 0; i--) {
    if (slides[i].dataset.checkpoint) return slides[i].dataset.checkpoint;
  }
  throw new Error(`Slide "${slide.id}" has no image checkpoint.`);
}

export function initialDemoMode(local, requested, saved) {
  if (!local) return 'images';
  const mode = requested ?? saved ?? 'live';
  if (!['live', 'images'].includes(mode)) throw new Error(`Unknown demo mode "${mode}".`);
  return mode;
}
