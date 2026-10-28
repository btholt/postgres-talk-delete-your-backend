import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createController } from './presenter/controller.js';
import { createPresenterMiddleware } from './presenter/middleware.js';

const token = randomBytes(32).toString('hex');

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        slides: fileURLToPath(new URL('./index.html', import.meta.url)),
        speaker: fileURLToPath(new URL('./speaker.html', import.meta.url)),
        apiDocs: fileURLToPath(new URL('./api-docs.html', import.meta.url)),
      },
    },
  },
  plugins: [{
    name: 'bundled-licenses',
    apply: 'build',
    generateBundle() {
      const readLicense = path => readFileSync(new URL(path, import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'third-party-licenses.txt',
        source: [
          'reveal.js\n\n' + readLicense('./node_modules/reveal.js/LICENSE'),
          'Source Sans Pro\n\n' + readLicense('./node_modules/reveal.js/css/theme/fonts/source-sans-pro/LICENSE'),
          'Swagger UI\n\n' + readLicense('./node_modules/swagger-ui-dist/LICENSE'),
          'Swagger UI notices\n\n' + readLicense('./node_modules/swagger-ui-dist/NOTICE'),
        ].join('\n\n'),
      });
    },
  }, {
    name: 'local-presenter',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__presenter', createPresenterMiddleware({
        controller: createController(),
        token,
      }));
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'presenter-token', content: token }, injectTo: 'head' }];
    },
  }],
});
