import { describe, expect, it, vi } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('generates a non-empty string', () => {
    expect(newId()).toBeTruthy();
    expect(typeof newId()).toBe('string');
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(newId());
    }
    // With 1000 IDs, all should be unique
    expect(ids.size).toBe(1000);
  });

  it('uses crypto.randomUUID when available', () => {
    // In the test environment crypto.randomUUID should be available
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      const id = newId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
  });

  it('falls back to a string with id- prefix when crypto is unavailable', () => {
    // Stub crypto to simulate an environment without it (e.g. insecure context)
    vi.stubGlobal('crypto', undefined);
    try {
      const id = newId();
      expect(id.startsWith('id-')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
