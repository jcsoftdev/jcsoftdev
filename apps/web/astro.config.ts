import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://jcsoftdev.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    envDir: '../..',
    plugins: [tailwindcss()],
    ssr: {
      external: ['@resvg/resvg-js'],
    },
    optimizeDeps: {
      exclude: ['@resvg/resvg-js'],
    },
    build: {
      modulePreload: {
        // Suppress eager <link rel="modulepreload"> for the heavy WebGL chunk
        // and its scroll/anim deps. They're mounted post-load so the browser
        // shouldn't waste high-priority bandwidth fetching them upfront.
        resolveDependencies: (_filename, deps) =>
          deps.filter((d) => !/HeroMesh|ScrollTrigger/.test(d)),
      },
    },
  },
});
