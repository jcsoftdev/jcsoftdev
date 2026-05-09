/**
 * Dynamic Open Graph image renderer.
 *
 * Pipeline: JSX → satori (SVG) → @resvg/resvg-js (PNG).
 * Fonts (Inter Regular + Bold WOFF) are served from /public/fonts/ and
 * fetched once per server start, then cached in module scope.
 */

import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const COLORS = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#262626',
  textPrimary: '#f5f5f5',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',
  accent: '#a78bfa',
  accentMuted: 'rgba(167, 139, 250, 0.18)',
};

let cachedFonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadFonts(origin: string): Promise<{
  regular: ArrayBuffer;
  bold: ArrayBuffer;
}> {
  if (cachedFonts) return cachedFonts;

  const [regular, bold] = await Promise.all([
    fetch(new URL('/fonts/og-inter-regular.woff', origin)).then((r) => r.arrayBuffer()),
    fetch(new URL('/fonts/og-inter-bold.woff', origin)).then((r) => r.arrayBuffer()),
  ]);

  cachedFonts = { regular, bold };
  return cachedFonts;
}

export interface OgRenderInput {
  title: string;
  description?: string | undefined;
  eyebrow?: string | undefined;
  origin: string;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function template({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string | null;
  eyebrow: string | null;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.bg,
        fontFamily: 'Inter',
        position: 'relative',
        padding: '64px 72px',
      }}
    >
      {/* Ambient orb (top right) */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -200,
          width: 700,
          height: 700,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${COLORS.accentMuted} 0%, transparent 65%)`,
        }}
      />

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 22,
          color: COLORS.textMuted,
          letterSpacing: '0.06em',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              background: COLORS.accent,
            }}
          />
          <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>jcsoftdev.com</span>
        </span>
        {eyebrow && (
          <span
            style={{
              fontSize: 18,
              color: COLORS.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              fontWeight: 700,
            }}
          >
            {eyebrow}
          </span>
        )}
      </div>

      {/* Spacer pushes title block to vertical center-bottom */}
      <div style={{ flex: 1, display: 'flex' }} />

      {/* Title */}
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 60 ? 64 : 80,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          fontWeight: 700,
          color: COLORS.textPrimary,
          maxWidth: 960,
        }}
      >
        {title}
      </div>

      {/* Description */}
      {description && (
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 28,
            lineHeight: 1.4,
            color: COLORS.textSecondary,
            maxWidth: 880,
          }}
        >
          {description}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 48,
          paddingTop: 28,
          borderTop: `1px solid ${COLORS.border}`,
          fontSize: 22,
          color: COLORS.textMuted,
        }}
      >
        <span style={{ color: COLORS.textSecondary }}>
          Juan Carlos Valencia · Senior Full-Stack Developer
        </span>
        <span style={{ color: COLORS.accent, fontWeight: 700 }}>→</span>
      </div>
    </div>
  );
}

export async function renderOg({
  title,
  description,
  eyebrow,
  origin,
}: OgRenderInput): Promise<Buffer> {
  const fonts = await loadFonts(origin);

  const safeTitle = truncate(title, 110);
  const safeDescription = description ? truncate(description, 180) : null;
  const safeEyebrow = eyebrow ? eyebrow.slice(0, 32) : null;

  const svg = await satori(
    template({
      title: safeTitle,
      description: safeDescription,
      eyebrow: safeEyebrow,
    }),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        {
          name: 'Inter',
          data: fonts.regular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: fonts.bold,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
  })
    .render()
    .asPng();

  return png;
}
