import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // Astro component tests (Badge, Button, Card, Link) use Container API and
    // require the Astro Vite transform — they run via vitest.astro.config.ts
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/components/ui/*.test.ts',
      'src/components/*.test.ts',
    ],
    globals: true,
  },
});
