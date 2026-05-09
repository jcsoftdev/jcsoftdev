/**
 * PortfolioHeroIsland — Hero section for the /portfolio page.
 *
 * Same 2-orb composition as HeroIsland but with portfolio-specific copy.
 * CTAs anchor to in-page sections (#experience, #projects).
 *
 * Data attributes preserved for existing GSAP timeline:
 * - [data-hero-title] — main heading
 * - [data-hero-sub]   — role/label line
 * - [data-hero-cta]   — CTA anchors (both)
 */

import { createCursorOrbTimeline, createHeroFadeTimeline, initLenis } from '@jcsoftdev/animations';
import { useEffect, useRef } from 'react';

export function PortfolioHeroIsland() {
  const rootRef = useRef<HTMLElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lenis = initLenis();
    const fade = rootRef.current ? createHeroFadeTimeline(rootRef.current) : null;
    const orb = orbRef.current ? createCursorOrbTimeline(orbRef.current) : null;

    return () => {
      lenis?.destroy();
      fade?.kill();
      orb?.kill();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden"
    >
      {/* Ambient violet orb — pure CSS, slow drift */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[-5%] h-[70vmax] w-[70vmax] rounded-full opacity-50"
        style={{
          background: 'radial-gradient(circle, var(--color-accent-soft) 0%, transparent 60%)',
          filter: 'blur(80px)',
          zIndex: 'var(--z-orbs)' as string,
          animation: 'dsi-orb-drift 20s ease-in-out infinite alternate',
        }}
      />

      {/* Cursor-tracked white orb */}
      <div
        ref={orbRef}
        aria-hidden
        data-cursor-orb
        className="pointer-events-none absolute left-0 top-0 h-[40vmax] w-[40vmax] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, oklch(1 0 0 / 0.10) 0%, transparent 55%)',
          filter: 'blur(60px)',
          zIndex: 'var(--z-orbs)' as string,
          willChange: 'transform',
        }}
      />

      {/* SVG noise overlay */}
      <svg
        aria-hidden
        role="presentation"
        className="pointer-events-none fixed inset-0 h-full w-full"
        style={{
          opacity: 0.04,
          mixBlendMode: 'overlay',
          zIndex: 'var(--z-orbs)' as string,
        }}
      >
        <filter id="portfolio-hero-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#portfolio-hero-noise)" />
      </svg>

      {/* Copy */}
      <div
        className="relative flex flex-col items-center gap-6 px-6 text-center"
        style={{ zIndex: 'var(--z-content)' as string }}
      >
        <h1
          data-hero-title
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(var(--text-5xl), 8vw, var(--text-9xl))',
            lineHeight: 'var(--leading-tight)',
            letterSpacing: 'var(--tracking-tighter)',
            color: 'var(--color-text-primary)',
          }}
        >
          Portfolio
        </h1>

        <p
          data-hero-sub
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-accent)',
            letterSpacing: 'var(--tracking-mono)',
          }}
        >
          Selected Work
        </p>

        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-text-muted)',
            maxWidth: '52ch',
          }}
        >
          8 years across SaaS, telecom, e-commerce, and government — Lima → global.
        </p>

        {/* CTAs — in-page anchors */}
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <a
            href="#experience"
            data-hero-cta
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              padding: '0.75rem 1.75rem',
              background: 'var(--color-accent)',
              color: 'oklch(0.10 0 0)',
              border: '1px solid transparent',
              textDecoration: 'none',
              transition: 'opacity var(--duration-fast)',
            }}
          >
            Experience
          </a>
          <a
            href="#projects"
            data-hero-cta
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: 'var(--text-sm)',
              padding: '0.75rem 1.75rem',
              background: 'transparent',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-accent)',
              textDecoration: 'none',
              transition: 'opacity var(--duration-fast)',
            }}
          >
            Projects
          </a>
        </div>
      </div>

      {/* Scroll cue */}
      <div
        className="absolute bottom-8 flex animate-bounce flex-col items-center gap-2"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          zIndex: 'var(--z-content)' as string,
        }}
      >
        <span>scroll</span>
        <svg
          aria-hidden
          role="presentation"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 3v10M4 9l4 4 4-4" />
        </svg>
      </div>
    </section>
  );
}

export default PortfolioHeroIsland;
