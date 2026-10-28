import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-legacy-server': fileURLToPath(new URL('./node_modules/react-dom/cjs/react-dom-server-legacy.browser.production.js', import.meta.url)),
    },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'ssr-dist',
    target: 'es2020',
    lib: { entry: 'src/render.jsx', name: 'KickstopperSSR', formats: ['iife'], fileName: () => 'react-ssr.js' },
    minify: 'esbuild',
  },
});
