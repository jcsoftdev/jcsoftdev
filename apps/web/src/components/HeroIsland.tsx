import { initLenis } from '@jcsoftdev/animations';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AUTHOR_GITHUB, AUTHOR_LINKEDIN } from '../lib/seo';
import Magnetic from './islands/Magnetic';
import { SignatureName } from './SignatureName';

/** Inline icon components — mobile only; the rail carries these on lg+. */
const GitHubIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    role="img"
    aria-label="GitHub"
  >
    <title>GitHub</title>
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.79.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    role="img"
    aria-label="LinkedIn"
  >
    <title>LinkedIn</title>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
);

function SocialIconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center border border-[color:var(--color-accent-muted)] bg-black/40 text-[color:var(--color-accent)] outline-none backdrop-blur-sm transition-colors duration-[var(--duration-fast)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
    >
      {children}
    </a>
  );
}

// Code-split Three.js out of the initial bundle. HeroMesh is the heaviest
// dependency (~720KB) so it ships in its own chunk that the browser fetches
// in parallel with the rest of the page. The H1 (LCP candidate) is plain
// SSR HTML so it paints at FCP regardless of when this chunk arrives.
const HeroMesh = lazy(() => import('./islands/HeroMesh'));

/** Steady-state ground behind the mesh, so the hero never flashes empty. */
function HeroMeshPlaceholder() {
  return <div aria-hidden className="absolute inset-0" style={{ background: 'oklch(0 0 0)' }} />;
}

/** Crossfades the WebGL canvas over the placeholder once the chunk resolves. */
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
 * HeroIsland — hero for the home page (/), rail layout.
 *
 * The planet is the hero's backdrop and sits behind all of the copy: the
 * signature's chromatic halo and the dark text shadows exist precisely to keep
 * type legible over the bright hemisphere. Boxing the mesh into a side panel
 * took that away, so it is full-bleed again — bounded by the section, which
 * starts after the rail, so it never runs under the navigation.
 *
 * The hero is a dark canvas in BOTH palettes. Copy colors here are literal
 * light values rather than var(--color-text-*) for that reason: under the light
 * palette those tokens resolve to near-black, which is unreadable on this
 * ground. This matches the scope note in global.css.
 *
 * Gone with the previous pass: the cursor-tracked orb (it overrode the pointer
 * affordance) and the scroll parallax (it fought the rail's fixed column).
 *
 * The entrance is CSS. A JS-driven one starts by setting opacity: 0, which
 * leaves the headline blank until this island hydrates — after a ~720KB chunk,
 * and forever if that chunk fails.
 */
export default function HeroIsland() {
  const rootRef = useRef<HTMLElement>(null);
  const [meshReady, setMeshReady] = useState(false);

  useEffect(() => {
    // Mount the WebGL chunk ASAP after hydration. The placeholder stays visible
    // behind, the lazy chunk fetches in parallel, and HeroMeshFadeIn crossfades
    // the canvas in once it is actually rendered. No artificial delays.
    const meshFrame = requestAnimationFrame(() => setMeshReady(true));
    const lenis = initLenis();

    return () => {
      cancelAnimationFrame(meshFrame);
      lenis?.destroy();
    };
  }, []);

  return (
    <section ref={rootRef} className="relative isolate overflow-hidden">
      {/* Mesh layer — spans the hero, behind everything. */}
      <div className="absolute inset-0 z-0">
        <HeroMeshPlaceholder />
        {meshReady && (
          <Suspense fallback={null}>
            <HeroMeshFadeIn />
          </Suspense>
        )}
      </div>

      {/* Readability scrim. Absolute pixel stops so the dark zone always covers
          the reading column regardless of viewport width. No backdrop-filter:
          that blurs the planet on the transparent side too, because the filter
          applies to the box rather than being modulated by alpha. */}
      <div
        aria-hidden
        data-hero-scrim
        className="absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(to right, oklch(0.04 0.005 270 / 0.95) 0px, oklch(0.04 0.005 270 / 0.90) min(430px, 40vw), oklch(0.04 0.005 270 / 0.62) min(660px, 58vw), oklch(0.04 0.005 270 / 0.28) min(880px, 76vw), oklch(0.04 0.005 270 / 0.08) min(1080px, 92vw), transparent min(1260px, 100vw))',
        }}
      />

      {/* Bottom fade into the section boundary below. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-[1] h-24"
        style={{
          background: 'linear-gradient(to bottom, transparent, var(--color-background))',
        }}
      />

      {/* Copy */}
      <div className="relative z-10 mx-auto flex min-h-[max(32rem,calc(100svh-var(--header-height)))] w-full max-w-[75rem] flex-col justify-center px-[var(--gutter)] py-[var(--section-py)]">
        <div className="flex w-full max-w-[min(62ch,100%)] flex-col items-start gap-4 @2xl:gap-5">
          <div
            data-hero-reveal
            style={{ '--hero-i': 0 } as React.CSSProperties}
            className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.08em] text-[oklch(0.90_0.01_270)] [text-shadow:0_0_4px_oklch(0.04_0_0/0.95),0_1px_10px_oklch(0.04_0_0/0.9)]"
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]"
              style={{ boxShadow: '0 0 8px var(--color-success)' }}
            />
            Bienvenido · Welcome · Available worldwide
          </div>

          {/* Signature name — animated per character in CSS */}
          <h1
            data-hero-title
            aria-label="Juan Carlos Valencia"
            style={{ margin: 0, padding: 0, width: '100%' }}
          >
            <SignatureName delay={0.2} />
          </h1>

          <svg
            aria-hidden="true"
            viewBox="0 0 280 20"
            preserveAspectRatio="none"
            style={{
              width: 'clamp(160px, 32vw, 280px)',
              height: '18px',
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

          <p
            data-hero-reveal
            data-hero-sub
            style={{ '--hero-i': 1 } as React.CSSProperties}
            className="m-0 font-mono text-base tracking-[0.05em] text-[color:var(--color-accent-hover)] [text-shadow:0_0_5px_oklch(0.04_0_0/0.95),0_1px_12px_oklch(0.04_0_0/0.92)]"
          >
            Senior Full-Stack Developer
          </p>

          <p
            data-hero-reveal
            style={{ '--hero-i': 2 } as React.CSSProperties}
            className="m-0 max-w-[min(44ch,100%)] text-[clamp(1.0625rem,0.95rem+0.6vw,1.375rem)] italic leading-[1.45] text-[oklch(0.96_0.005_270)] [text-shadow:0_0_6px_oklch(0.04_0_0/0.95),0_1px_14px_oklch(0.04_0_0/0.95)]"
          >
            I build software that doesn't fight you — from interface to infrastructure. Multi-tenant
            SaaS, enterprise microservices, telecom, e-commerce.
          </p>

          <div
            data-hero-reveal
            style={{ '--hero-i': 3 } as React.CSSProperties}
            className="mt-2 flex w-full flex-col items-stretch gap-3 min-[26rem]:w-auto min-[26rem]:flex-row min-[26rem]:items-center min-[26rem]:gap-4"
          >
            <Magnetic strength={0.4} className="w-full min-[26rem]:w-auto">
              <a
                href="#work"
                data-hero-cta
                className="flex w-full items-center justify-center gap-2.5 rounded-md bg-[color:var(--color-accent)] px-7 py-3.5 min-[26rem]:w-auto font-sans text-sm font-semibold text-[oklch(0.10_0_0)] outline-none transition-[filter,box-shadow] duration-[var(--duration-fast)] hover:brightness-110 hover:shadow-[0_8px_32px_-8px_var(--color-accent-muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                View selected work
                <span aria-hidden>→</span>
              </a>
            </Magnetic>
            <a
              href="/resume"
              data-hero-cta
              className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-black/40 px-6 py-3.5 min-[26rem]:w-auto font-mono text-xs uppercase tracking-[0.05em] text-[oklch(0.92_0.01_270)] outline-none backdrop-blur-sm transition-colors duration-[var(--duration-fast)] hover:border-[color:var(--color-accent-muted)] hover:text-white focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
            >
              Read the résumé
              <span aria-hidden>↗</span>
            </a>
          </div>

          <div
            data-hero-reveal
            style={{ '--hero-i': 4 } as React.CSSProperties}
            className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-white/15 pt-4 font-mono text-xs text-[oklch(0.90_0.01_270)] [text-shadow:0_0_5px_oklch(0.04_0_0/0.95),0_1px_10px_oklch(0.04_0_0/0.92)]"
          >
            <span className="uppercase tracking-[0.2em] text-[oklch(0.72_0.01_270)]">Latest</span>
            <span>
              Multi-tenant web-monitoring SaaS — Go, Next.js 16, schema-per-tenant Postgres, AI
              insights on Bedrock.
            </span>
          </div>

          {/* Social icons — mobile only; the rail carries these on lg+ */}
          <nav
            data-hero-reveal
            style={{ '--hero-i': 5 } as React.CSSProperties}
            aria-label="Social links"
            className="mt-2 flex gap-3 lg:hidden"
          >
            <SocialIconButton href={AUTHOR_GITHUB} label="GitHub">
              <GitHubIcon />
            </SocialIconButton>
            <SocialIconButton href={AUTHOR_LINKEDIN} label="LinkedIn">
              <LinkedInIcon />
            </SocialIconButton>
          </nav>
        </div>
      </div>
    </section>
  );
}
