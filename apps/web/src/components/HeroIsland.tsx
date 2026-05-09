import { createCursorOrbTimeline, createHeroFadeTimeline, initLenis } from '@jcsoftdev/animations';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef } from 'react';
import HeroMesh from './islands/HeroMesh';
import Magnetic from './islands/Magnetic';
import { SignatureName } from './SignatureName';

gsap.registerPlugin(ScrollTrigger);

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

  useEffect(() => {
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
      <HeroMesh />

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
        className="relative mx-auto w-full max-w-[1280px] px-6 lg:px-12 will-change-transform"
        style={{ zIndex: 'var(--z-content)' as string }}
      >
        <div className="flex max-w-[68ch] flex-col items-start gap-6">
          {/* Eyebrow */}
          <div
            data-hero-reveal
            className="flex items-center gap-3"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
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
            Available worldwide · Based in Lima, Peru
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
                color: 'var(--color-accent)',
                letterSpacing: '0.05em',
                margin: 0,
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
              color: 'var(--color-text-secondary)',
              maxWidth: '42ch',
              lineHeight: '1.45',
              margin: 0,
            }}
          >
            Building clean, fast, purposeful software — across SaaS, telecom, e-commerce, and
            government, from Lima to global teams.
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
                color: 'var(--color-text-muted)',
                textDecoration: 'none',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                transition: 'color var(--duration-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
            >
              Or read the writing
              <span aria-hidden>↗</span>
            </a>
          </div>

          {/* Now-line */}
          <div
            data-hero-reveal
            className="mt-8 border-t pt-6"
            style={{
              borderColor: 'var(--color-border-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.04em',
              lineHeight: '1.6',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)' }}>Now</span> building{' '}
            <a
              href="https://pulzifi.com"
              rel="noopener noreferrer"
              target="_blank"
              style={{
                color: 'var(--color-text-primary)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--color-accent-muted)',
                textUnderlineOffset: '3px',
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
