import gsap from 'gsap';
import { Fragment, useEffect, useRef } from 'react';

/**
 * SignatureName — RGB-split glitch reveal of "Juan Carlos Valencia".
 *
 * Each letter renders with two colored text-shadows (magenta-red shifted left,
 * cyan shifted right). The shift distance is driven by a per-char CSS variable
 * --glitch-x animated from a wide offset down to 0 — the chromatic aberration
 * "converges" into clean white text. A subtle y-cascade + opacity fade run
 * alongside, with a small terminal flicker right before each char locks.
 */

const WORDS = ['Juan', 'Carlos', 'Valencia'] as const;

interface Props {
  delay?: number;
}

export function SignatureName({ delay = 0.1 }: Props) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chars = Array.from(root.querySelectorAll<HTMLElement>('[data-sig-char]'));
    if (chars.length === 0) return;

    const setVar = (el: HTMLElement, name: string, value: string) => {
      el.style.setProperty(name, value);
    };

    if (reduced) {
      for (const el of chars) {
        setVar(el, '--glitch-x', '0px');
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }
      return;
    }

    // Initial state: chars hidden, fully split
    for (const el of chars) {
      setVar(el, '--glitch-x', '16px');
      el.style.opacity = '0';
      el.style.transform = 'translateY(28px)';
    }

    const tl = gsap.timeline({ delay });

    // Per-char stagger: fade up + converge RGB
    chars.forEach((el, i) => {
      const start = i * 0.045;

      // Fade up + appear
      tl.to(
        el,
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: 'expo.out',
        },
        start
      );

      // Animate the CSS var --glitch-x from 16 → 0 (chromatic aberration convergence)
      const proxy = { v: 16 };
      tl.to(
        proxy,
        {
          v: 0,
          duration: 0.95,
          ease: 'power3.out',
          onUpdate: () => {
            setVar(el, '--glitch-x', `${proxy.v.toFixed(2)}px`);
          },
        },
        start + 0.05
      );

      // Brief flicker right before lock — quick split-back-and-forth
      tl.to(
        proxy,
        {
          v: 4,
          duration: 0.08,
          ease: 'none',
          repeat: 1,
          yoyo: true,
          onUpdate: () => {
            setVar(el, '--glitch-x', `${proxy.v.toFixed(2)}px`);
          },
        },
        start + 0.78
      );

      // Final settle to 0
      tl.to(
        proxy,
        {
          v: 0,
          duration: 0.18,
          ease: 'power2.out',
          onUpdate: () => {
            setVar(el, '--glitch-x', `${proxy.v.toFixed(2)}px`);
          },
        },
        start + 0.95
      );
    });

    return () => {
      tl.kill();
    };
  }, [delay]);

  return (
    <span
      ref={rootRef}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-sans), "Geist", system-ui, sans-serif',
        fontWeight: 700,
        fontStyle: 'italic',
        fontSize: 'clamp(2.75rem, 8vw, 6.5rem)',
        lineHeight: 1.02,
        letterSpacing: '-0.025em',
        color: 'var(--color-text-primary)',
      }}
    >
      {WORDS.map((word, wi) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: WORDS is a static const array; index is stable
        <Fragment key={wi}>
          <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            {word.split('').map((c, ci) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: characters per word are stable in order
                key={`${wi}-${ci}`}
                data-sig-char
                style={{
                  display: 'inline-block',
                  willChange: 'transform, opacity, text-shadow',
                  // Two colored shadows that converge as --glitch-x → 0.
                  // Colors match the HeroMesh planet: violet (#7722ff, rim
                  // glow + outer ring) on the left, cyan (#00aaff, fresnel +
                  // inner ring + circuit nodes) on the right.
                  textShadow: `
                    calc(-1 * var(--glitch-x, 0px)) 0 0 oklch(0.50 0.27 290 / 0.88),
                    var(--glitch-x, 0px) 0 0 oklch(0.71 0.17 240 / 0.88)
                  `,
                }}
              >
                {c}
              </span>
            ))}
          </span>
          {wi < WORDS.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  );
}

export default SignatureName;
