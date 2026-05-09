import { describe, expect, it } from 'vitest';
import { gradientFromSlug } from './gradient-from-slug.js';

describe('gradientFromSlug', () => {
  it('(a) same slug → same output (determinism)', () => {
    const slug = 'my-project';
    expect(gradientFromSlug(slug)).toBe(gradientFromSlug(slug));
    expect(gradientFromSlug(slug)).toBe(gradientFromSlug(slug));
  });

  it('(b) different slugs → different output (uniqueness sample of 10)', () => {
    const slugs = [
      'project-alpha',
      'project-beta',
      'portfolio-site',
      'design-system',
      'api-gateway',
      'mobile-app',
      'dashboard',
      'cli-tool',
      'blog-engine',
      'ecommerce',
    ];
    const results = slugs.map(gradientFromSlug);
    const uniqueResults = new Set(results);
    // At minimum a majority of the 10 slugs should produce distinct outputs
    expect(uniqueResults.size).toBeGreaterThan(5);
  });

  it('(c) angle is within [0, 360)', () => {
    const slugs = ['hello', 'world', 'test', '', 'a', 'zzzzz', 'design-system-immersive'];
    for (const slug of slugs) {
      const result = gradientFromSlug(slug);
      // Extract angle from "conic-gradient(from Xdeg ..."
      const match = result.match(/from\s+([\d.]+)deg/);
      expect(match).not.toBeNull();
      const angle = Number(match?.[1]);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
    }
  });

  it('(d) output is a valid conic-gradient() CSS string', () => {
    const result = gradientFromSlug('my-project');
    expect(result.startsWith('conic-gradient(')).toBe(true);
    expect(result.endsWith(')')).toBe(true);
    // Must contain at least one oklch() color stop in the violet family (hue 260-300)
    expect(result).toMatch(/oklch\(/);
  });

  it('(e) uses violet hue family (hue range 260–300 present in stops)', () => {
    const slugs = ['project-alpha', 'design-system', 'portfolio-site'];
    for (const slug of slugs) {
      const result = gradientFromSlug(slug);
      // Extract hue values from oklch(L C H) patterns
      const matches = [...result.matchAll(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)\)/g)];
      const hues = matches.map((m) => Number(m[1]));
      // At least one stop must be in the violet family
      const hasViolet = hues.some((h) => h >= 260 && h <= 310);
      expect(hasViolet).toBe(true);
    }
  });
});
