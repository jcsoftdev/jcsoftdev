import { useEffect, useRef, useState } from 'react';

/**
 * Click-to-copy email with inline confirmation.
 *
 * The contact section's only conversion path was a bare `mailto:`, which is real
 * friction on mobile and on webmail — it opens the wrong client, or nothing at
 * all, and the visitor silently gives up. Copying is the path that always works.
 *
 * The mailto stays available as a secondary action for people who do have a
 * desktop client wired up: two paths, not one.
 */

interface CopyEmailProps {
  email: string;
  /** Reply-time promise rendered under the address. */
  note?: string;
}

const CONFIRM_MS = 2000;

export default function CopyEmail({ email, note }: CopyEmailProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      // clipboard.writeText needs a secure context; it is absent over plain
      // http and in some in-app browsers. Fall back rather than throwing.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        throw new Error('clipboard unavailable');
      }
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = setTimeout(() => setState('idle'), CONFIRM_MS);
  }

  const label =
    state === 'copied'
      ? 'Copied'
      : state === 'failed'
        ? 'Press Cmd-C to copy'
        : 'Copy email address';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          aria-label={`${label}: ${email}`}
          className="group inline-flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
          style={{
            borderColor: 'var(--color-border-soft)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}
        >
          <span className="font-display text-xl font-semibold break-all md:text-2xl">{email}</span>
          <span
            aria-hidden="true"
            className="font-mono text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {state === 'copied' ? '✓' : '⧉'}
          </span>
        </button>

        <a
          href={`mailto:${email}`}
          className="font-mono text-xs uppercase tracking-[0.15em] underline underline-offset-4"
          style={{ color: 'var(--color-text-muted)' }}
        >
          or open mail app
        </a>
      </div>

      {/* Announced to screen readers when it flips; visible to everyone else. */}
      <p
        aria-live="polite"
        className="font-mono text-xs"
        style={{
          color: state === 'copied' ? 'var(--color-accent)' : 'var(--color-text-muted)',
          minHeight: '1.2em',
        }}
      >
        {state === 'idle' ? (note ?? '') : label}
      </p>
    </div>
  );
}
