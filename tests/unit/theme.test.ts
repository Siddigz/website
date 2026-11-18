import { describe, it, expect } from 'vitest';
import { readStoredScheme, nextScheme, overrideFor } from '../../src/lib/theme';

describe('readStoredScheme', () => {
  it('returns a stored valid scheme', () => {
    expect(readStoredScheme({ getItem: () => 'dark' })).toBe('dark');
  });
  it('ignores anything else', () => {
    expect(readStoredScheme({ getItem: () => 'purple' })).toBeNull();
    expect(readStoredScheme({ getItem: () => null })).toBeNull();
  });
  it('returns null when storage is missing or throws', () => {
    expect(readStoredScheme(undefined)).toBeNull();
    expect(readStoredScheme({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
});

it('nextScheme flips', () => {
  expect(nextScheme('light')).toBe('dark');
  expect(nextScheme('dark')).toBe('light');
});

describe('overrideFor', () => {
  it('stores a target that differs from the system', () => {
    expect(overrideFor('dark', 'light')).toBe('dark');
    expect(overrideFor('light', 'dark')).toBe('light');
  });
  it('stores nothing when the target matches the system', () => {
    expect(overrideFor('light', 'light')).toBeNull();
    expect(overrideFor('dark', 'dark')).toBeNull();
  });
});
