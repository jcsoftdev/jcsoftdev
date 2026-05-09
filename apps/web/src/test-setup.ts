import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// jsdom stubs — browser APIs not implemented by jsdom
// Guard with typeof window so this file can be safely loaded in node env
// (Astro Container API tests run with @vitest-environment node).
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  // GSAP's ScrollTrigger calls window.matchMedia at module-import time.
  // Lenis reads matchMedia for pointer:coarse detection.
  // Stub returns { matches: false } for all media queries.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Lenis uses ResizeObserver internally — jsdom does not implement it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
