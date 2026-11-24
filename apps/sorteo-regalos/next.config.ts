import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repositoryRoot,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
