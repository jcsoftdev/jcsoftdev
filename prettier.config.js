// prettier.config.js
// Prettier is scoped to .astro files ONLY.
// All other file types (.ts, .tsx, .js, .json) are handled by Biome.
/** @type {import('prettier').Config} */
export default {
  plugins: ['prettier-plugin-astro'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
};
