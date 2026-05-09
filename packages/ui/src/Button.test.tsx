import { describe, expect, it } from 'vitest';

describe('@jcsoftdev/ui - Button', () => {
  it('Button is exported from the package index', async () => {
    const { Button } = await import('./index.js');
    expect(typeof Button).toBe('function');
  });
});
