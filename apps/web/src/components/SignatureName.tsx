import { Fragment } from 'react';

/**
 * SignatureName — the hero H1, animated per character.
 *
 * The animation is CSS, not GSAP, and that is load-bearing: this markup is
 * server-rendered and painted before the hero island hydrates. A JS entrance
 * has to start by setting opacity: 0, so the name appeared, vanished on
 * hydration, and faded back in — a flash that got worse the later hydration
 * landed (the island is client:idle behind a ~720KB Three.js chunk). With
 * `both` fill the from-state only applies while the animation is actually
 * running, so with animations off the name is simply there.
 *
 * Per-character delay comes from --sig-i, stamped at render time.
 */

const WORDS = ['Juan', 'Carlos', 'Valencia'] as const;

interface Props {
  /** Seconds before the first character starts. */
  delay?: number;
}

export function SignatureName({ delay = 0.1 }: Props) {
  // Flat index across words — the stagger runs through the whole name, not
  // restarting per word.
  let charIndex = -1;

  return (
    <span
      data-sig-root
      style={
        {
          display: 'inline-block',
          fontFamily: 'var(--font-sans), "Geist", system-ui, sans-serif',
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: 'clamp(2.75rem, 8vw, 6.5rem)',
          lineHeight: 1.02,
          letterSpacing: '-0.025em',
          // Literal, not var(--color-text-primary): the hero is a dark canvas
          // behind the planet in both palettes, so this text is always light.
          color: 'oklch(0.96 0 0)',
          '--sig-delay': `${delay}s`,
        } as React.CSSProperties
      }
    >
      {WORDS.map((word, wi) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: WORDS is a static const array; index is stable
        <Fragment key={wi}>
          <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            {word.split('').map((c, ci) => {
              charIndex += 1;
              return (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: characters per word are stable in order
                  key={`${wi}-${ci}`}
                  data-sig-char
                  style={
                    {
                      display: 'inline-block',
                      '--sig-i': charIndex,
                      // Two colored shadows that converge as --glitch-x → 0.
                      // Colors match the HeroMesh planet: violet (#7722ff, rim
                      // glow + outer ring) on the left, cyan (#00aaff, fresnel +
                      // inner ring + circuit nodes) on the right. The dark
                      // multi-radius halo is for legibility over the bright
                      // hemisphere of the planet — does not affect convergence.
                      textShadow: `
                    calc(-1 * var(--glitch-x, 0px)) 0 0 oklch(0.50 0.27 290 / 0.88),
                    var(--glitch-x, 0px) 0 0 oklch(0.71 0.17 240 / 0.88),
                    0 0 6px oklch(0.04 0 0 / 0.95),
                    0 2px 14px oklch(0.04 0 0 / 0.92),
                    0 0 36px oklch(0.04 0 0 / 0.75)
                  `,
                    } as React.CSSProperties
                  }
                >
                  {c}
                </span>
              );
            })}
          </span>
          {wi < WORDS.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  );
}

export default SignatureName;
