export function readPresenterGuide(markdown) {
  const headings = [...markdown.matchAll(/^## Slide ([1-9]\d*): (.+)\r?$/gm)];
  if (!headings.length) throw new Error('demo.md must contain numbered Slide headings.');
  return headings.map((heading, index) => {
    const number = Number(heading[1]);
    if (number !== index + 1) throw new Error(`demo.md must have consecutive Slide headings; expected Slide ${index + 1}.`);
    const body = markdown.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? markdown.length);
    const notes = body.split(/^#{2,3}\s/m)[0].trim();
    if (!notes || notes.split('\n').filter(line => line.trim()).some(line => !/^\s*- /.test(line))) {
      throw new Error(`Slide ${number} in demo.md must start with speaker-note bullets.`);
    }
    return { number, title: heading[2].trim(), notes, body };
  });
}

export function withPresenterNotes(slideMarkdown, guideMarkdown) {
  if (/^Notes:\s*$/m.test(slideMarkdown)) {
    throw new Error('Edit speaker notes in demo.md, not slides/deck.md.');
  }
  const slides = slideMarkdown.trim().split(/\r?\n---\r?\n/);
  const guide = readPresenterGuide(guideMarkdown);
  if (slides.length !== guide.length) throw new Error('demo.md must have one Slide section for every presentation slide.');
  return slides.map((slide, index) => `${slide.trim()}\n\nNotes:\n${guide[index].notes}`).join('\n\n---\n\n');
}
