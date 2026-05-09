// Vitest config for Astro Container API component tests.
// Uses getViteConfig from astro/config to include the Astro Vite transform.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    name: 'astro-components',
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/components/ui/*.test.ts', 'src/components/*.test.ts'],
    globals: true,
  },
});
