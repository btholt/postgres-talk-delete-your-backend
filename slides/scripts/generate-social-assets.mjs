import { readFile, writeFile } from 'node:fs/promises';
import { openBrowser } from './browser.mjs';

const assets = [
  { source: 'favicon.svg', output: 'favicon-32.png', width: 32, height: 32 },
  { source: 'favicon.svg', output: 'apple-touch-icon.png', width: 180, height: 180 },
  { source: 'social-card.svg', output: 'social-card.png', width: 1200, height: 630 },
];
const fonts = await Promise.all(['regular', 'semibold'].map(async (name, index) => ({
  weight: index === 0 ? '400' : '600',
  data: (await readFile(new URL(`../node_modules/reveal.js/css/theme/fonts/source-sans-pro/source-sans-pro-${name}.woff`, import.meta.url))).toString('base64'),
})));
const browser = await openBrowser();

try {
  const page = await browser.newPage('about:blank');
  for (const { source, output, width, height } of assets) {
    await browser.command('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
    }, page);
    await browser.command('Emulation.setDefaultBackgroundColorOverride', {
      color: output === 'apple-touch-icon.png'
        ? { r: 16, g: 20, b: 18, a: 1 }
        : { r: 0, g: 0, b: 0, a: 0 },
    }, page);
    await browser.command('Page.navigate', {
      url: new URL(`../public/${source}`, import.meta.url).href,
    }, page);
    await browser.wait(page, `document.readyState === 'complete' && document.documentElement.id === ${JSON.stringify(source.slice(0, -4))}`);
    await browser.evaluate(page, `(() => {
      document.documentElement.setAttribute('width', '${width}');
      document.documentElement.setAttribute('height', '${height}');
      return true;
    })()`);
    if (source === 'social-card.svg') {
      await browser.evaluate(page, `(async () => {
        for (const { weight, data } of ${JSON.stringify(fonts)}) {
          const font = new FontFace('Source Sans Pro', 'url(data:font/woff;base64,' + data + ')', { weight });
          document.fonts.add(await font.load());
        }
        await document.fonts.ready;
        return true;
      })()`);
    }
    const screenshot = await browser.command('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width, height, scale: 1 },
    }, page);
    await writeFile(new URL(`../public/${output}`, import.meta.url), Buffer.from(screenshot.data, 'base64'));
    console.log(`Generated ${output} (${width}x${height}).`);
  }
} finally {
  await browser.close();
}
