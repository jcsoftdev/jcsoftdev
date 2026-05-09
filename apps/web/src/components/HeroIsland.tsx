import { createCursorOrbTimeline, createHeroFadeTimeline, initLenis } from '@jcsoftdev/animations';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Magnetic from './islands/Magnetic';
import { SignatureName } from './SignatureName';

// Code-split Three.js out of the initial bundle. HeroMesh is the heaviest
// dependency (~720KB) so it ships in its own chunk that the browser fetches
// in parallel with the rest of the page. The H1 (LCP candidate) is plain
// SSR HTML so it paints at FCP regardless of when this chunk arrives.
const HeroMesh = lazy(() => import('./islands/HeroMesh'));

gsap.registerPlugin(ScrollTrigger);

/** Static gradient that matches the steady-state HeroMesh look. Renders
 * during the idle window before the mesh chunk loads, preventing layout
 * shift and giving the eye something to land on while WebGL boots. */
function HeroMeshPlaceholder() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(circle at 75% 50%, oklch(0.18 0.08 280 / 0.45) 0%, oklch(0.04 0.005 270) 70%)',
      }}
    />
  );
}

/** Fades the WebGL canvas in once the lazy chunk has loaded and React has
 * mounted HeroMesh. Suspending parents block this component's render until
 * the chunk resolves, so the rAF here fires AFTER the canvas exists in DOM
 * — no pop-in, the canvas crossfades over the placeholder gradient. */
function HeroMeshFadeIn() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 900ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity',
      }}
    >
      <HeroMesh />
    </div>
  );
}

/**
 * HeroIsland — full-viewport hero for the home page (/).
 *
 * Data attributes:
 * - [data-hero-title] — main heading (accessible label on wrapper)
 * - [data-hero-sub]   — role line
 * - [data-hero-cta]   — CTA links
 */
export default function HeroIsland() {
  const rootRef = useRef<HTMLElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [meshReady, setMeshReady] = useState(false);

  useEffect(() => {
    // Mount the WebGL chunk ASAP after hydration. The placeholder gradient
    // stays visible behind, the lazy chunk fetches in parallel, and
    // HeroMeshFadeIn crossfades the canvas in once it's actually rendered.
    // No artificial delays, no pop-in.
    const meshFrame = requestAnimationFrame(() => setMeshReady(true));

    const lenis = initLenis({ withScrollTriggerBridge: true });
    const fade = rootRef.current ? createHeroFadeTimeline(rootRef.current) : null;
    const orb = orbRef.current ? createCursorOrbTimeline(orbRef.current) : null;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let parallax: gsap.core.Tween | null = null;
    let entrance: gsap.core.Timeline | null = null;

    if (!reduced && contentRef.current) {
      const elements = contentRef.current.querySelectorAll<HTMLElement>('[data-hero-reveal]');
      const svgPath = contentRef.current.querySelector<SVGPathElement>('[data-hero-sig-path]');

      // SVG underline
      let pathLen = 0;
      if (svgPath) {
        pathLen = svgPath.getTotalLength();
        gsap.set(svgPath, { strokeDasharray: pathLen, strokeDashoffset: pathLen });
      }

      if (elements.length > 0) {
        gsap.set(elements, { y: 24, opacity: 0, filter: 'blur(8px)' });
        entrance = gsap.timeline({ delay: 0.1 });
        entrance.to(elements, {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.08,
        });
      }

      // SVG underline draws in after the signature (~1.8s) + 0.1s gap
      if (svgPath && pathLen > 0) {
        entrance = entrance ?? gsap.timeline({ delay: 0.1 });
        entrance.to(svgPath, { strokeDashoffset: 0, duration: 0.8, ease: 'expo.out' }, 1.9);
      }

      // Scroll parallax
      if (rootRef.current) {
        parallax = gsap.to(contentRef.current, {
          y: -80,
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        });
      }
    }

    return () => {
      cancelAnimationFrame(meshFrame);
      parallax?.scrollTrigger?.kill();
      parallax?.kill();
      entrance?.kill();
      lenis?.destroy();
      fade?.kill();
      orb?.kill();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[calc(100svh_-_var(--header-height))] items-center overflow-hidden"
    >
      {/* CSS placeholder stays as a layer behind the WebGL canvas so the LCP
          candidate is stable across the upgrade. The canvas crossfades over
          it via HeroMeshFadeIn once the lazy chunk arrives — no pop-in. */}
      <HeroMeshPlaceholder />
      {meshReady && (
        <Suspense fallback={null}>
          <HeroMeshFadeIn />
        </Suspense>
      )}

      {/* Readability scrim — absolute pixel stops so the dark zone always
          covers the text reading area regardless of viewport width.
          No backdrop-filter: that would blur the planet on the transparent
          side too (filter applies to the box, not modulated by alpha). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, oklch(0.04 0.005 270 / 0.96) 0px, oklch(0.04 0.005 270 / 0.92) min(460px, 38vw), oklch(0.04 0.005 270 / 0.65) min(720px, 58vw), oklch(0.04 0.005 270 / 0.30) min(980px, 76vw), oklch(0.04 0.005 270 / 0.10) min(1200px, 92vw), transparent min(1400px, 100vw))',
          zIndex: 1,
        }}
      />

      {/* Cursor-tracked highlight orb */}
      <div
        ref={orbRef}
        aria-hidden
        data-cursor-orb
        className="pointer-events-none absolute left-0 top-0 h-[30vmax] w-[30vmax] rounded-full"
        style={{
          background: 'radial-gradient(circle, oklch(1 0 0 / 0.05) 0%, transparent 55%)',
          filter: 'blur(40px)',
          zIndex: 'var(--z-orbs)' as string,
          mixBlendMode: 'screen',
        }}
      />

      {/* SVG noise overlay */}
      <svg
        aria-hidden
        role="presentation"
        className="pointer-events-none fixed inset-0 h-full w-full"
        style={{ opacity: 0.035, mixBlendMode: 'overlay', zIndex: 'var(--z-orbs)' as string }}
      >
        <filter id="hero-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" />
      </svg>

      {/* Copy */}
      <div
        ref={contentRef}
        className="relative mx-auto w-full max-w-[1280px] px-5 md:px-8 lg:px-12 will-change-transform"
        style={{ zIndex: 'var(--z-content)' as string }}
      >
        <div className="flex max-w-[68ch] flex-col items-start gap-4 md:gap-6">
          {/* Eyebrow */}
          <div
            data-hero-reveal
            className="flex items-center gap-3"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'oklch(0.88 0.01 270)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textShadow:
                '0 0 4px oklch(0.04 0 0 / 0.95), 0 1px 10px oklch(0.04 0 0 / 0.9), 0 0 22px oklch(0.04 0 0 / 0.65)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--color-accent)',
                boxShadow: '0 0 8px var(--color-accent)',
              }}
            />
            Bienvenido · Welcome · Available worldwide
          </div>

          {/* Signature name — real handwriting, drawn with GSAP */}
          <h1
            data-hero-title
            aria-label="Juan Carlos Valencia"
            style={{ margin: 0, padding: 0, width: '100%' }}
          >
            <SignatureName delay={0.2} />
          </h1>

          {/* SVG curved underline — draws in after signature */}
          <svg
            aria-hidden="true"
            viewBox="0 0 280 20"
            preserveAspectRatio="none"
            style={{
              width: 'clamp(160px, 36vw, 280px)',
              height: '20px',
              overflow: 'visible',
              display: 'block',
              marginTop: '-0.5rem',
            }}
          >
            <path
              data-hero-sig-path
              d="M4 15 C 50 4, 120 20, 190 11 C 230 6, 262 16, 276 13"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px var(--color-accent))' }}
            />
          </svg>

          {/* Role */}
          <div data-hero-reveal className="flex flex-col gap-3">
            <p
              data-hero-sub
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-base)',
                color: 'oklch(0.82 0.13 280)',
                letterSpacing: '0.05em',
                margin: 0,
                textShadow:
                  '0 0 5px oklch(0.04 0 0 / 0.95), 0 1px 12px oklch(0.04 0 0 / 0.92), 0 0 28px oklch(0.04 0 0 / 0.7)',
              }}
            >
              Senior Full-Stack Developer
            </p>
          </div>

          {/* Statement */}
          <p
            data-hero-reveal
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(1.125rem, 1.6vw, 1.5rem)',
              fontStyle: 'italic',
              color: 'oklch(0.96 0.005 270)',
              maxWidth: '42ch',
              lineHeight: '1.45',
              margin: 0,
              textShadow:
                '0 0 6px oklch(0.04 0 0 / 0.95), 0 1px 14px oklch(0.04 0 0 / 0.95), 0 0 32px oklch(0.04 0 0 / 0.75)',
            }}
          >
            You're in. I build software that doesn't fight you. SaaS, telecom, e-commerce,
            education.
          </p>

          {/* CTAs */}
          <div data-hero-reveal className="mt-2 flex flex-wrap items-center gap-5">
            <Magnetic strength={0.4}>
              <a
                href="#work"
                data-hero-cta
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  padding: '0.875rem 1.75rem',
                  background: 'var(--color-accent)',
                  color: 'oklch(0.10 0 0)',
                  border: '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'filter var(--duration-fast), box-shadow var(--duration-base)',
                  boxShadow: '0 0 0 0 transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.08)';
                  e.currentTarget.style.boxShadow = '0 8px 32px -8px oklch(0.74 0.16 280 / 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)';
                  e.currentTarget.style.boxShadow = '0 0 0 0 transparent';
                }}
              >
                View Selected Work
                <span aria-hidden style={{ transition: 'transform var(--duration-fast)' }}>
                  →
                </span>
              </a>
            </Magnetic>
            <a
              href="/blog"
              data-hero-cta
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: 'var(--text-xs)',
                color: 'oklch(0.92 0.01 270)',
                textDecoration: 'none',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textShadow:
                  '0 0 5px oklch(0.04 0 0 / 0.95), 0 1px 10px oklch(0.04 0 0 / 0.92), 0 0 22px oklch(0.04 0 0 / 0.7)',
                transition: 'color var(--duration-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'oklch(0.98 0 0)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'oklch(0.88 0.01 270)';
              }}
            >
              Or read the writing
              <span aria-hidden>↗</span>
            </a>
          </div>

          {/* Now-line */}
          <div
            data-hero-reveal
            className="mt-6 md:mt-8 border-t pt-5 md:pt-6"
            style={{
              borderColor: 'oklch(0.50 0.02 270 / 0.4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'oklch(0.92 0.01 270)',
              letterSpacing: '0.04em',
              lineHeight: '1.6',
              textShadow:
                '0 0 5px oklch(0.04 0 0 / 0.95), 0 1px 10px oklch(0.04 0 0 / 0.92), 0 0 22px oklch(0.04 0 0 / 0.7)',
            }}
          >
            <span style={{ color: 'oklch(0.96 0 0)' }}>Now</span> building{' '}
            <a
              href="https://pulzifi.com"
              rel="noopener noreferrer"
              target="_blank"
              style={{
                color: 'oklch(0.98 0 0)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--color-accent-muted)',
                textUnderlineOffset: '3px',
                fontWeight: 600,
              }}
            >
              Pulzifi
            </a>{' '}
            — web monitoring SaaS with AI insights.
          </div>
        </div>
      </div>
    </section>
  );
}
