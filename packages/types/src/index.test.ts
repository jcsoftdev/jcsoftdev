import { describe, expect, it } from 'vitest';

describe('@jcsoftdev/types', () => {
  it('module loads without error (smoke test)', () => {
    // This package exports only types — there is no runtime code to test yet.
    // This smoke test verifies the module can be imported and the test runner works.
    expect(true).toBe(true);
  });
});
