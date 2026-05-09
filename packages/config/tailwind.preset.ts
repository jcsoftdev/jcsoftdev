/**
 * Tailwind v4 CSS-first preset for jcsoftdev.
 *
 * In Tailwind v4, configuration is CSS-first via @theme directives.
 * This file exports theme tokens and plugin references that consuming
 * apps can spread into their own CSS @theme blocks.
 *
 * Usage in an app's global CSS:
 *   @import "@jcsoftdev/config/tailwind.preset";
 *   @theme { ... override tokens here ... }
 */

export const preset = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: 'oklch(97% 0.02 250)',
          100: 'oklch(93% 0.04 250)',
          200: 'oklch(87% 0.08 250)',
          300: 'oklch(78% 0.13 250)',
          400: 'oklch(68% 0.18 250)',
          500: 'oklch(58% 0.22 250)',
          600: 'oklch(50% 0.22 250)',
          700: 'oklch(42% 0.20 250)',
          800: 'oklch(34% 0.16 250)',
          900: 'oklch(26% 0.12 250)',
          950: 'oklch(18% 0.08 250)',
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-in-out',
        'slide-up': 'slide-up 0.6s ease-out',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(2rem)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} as const;

export type Preset = typeof preset;
