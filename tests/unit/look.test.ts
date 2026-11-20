import { describe, it, expect } from 'vitest';
import { DEFAULT_LOOK, LOOKS, LOOK_LABELS, isLook, pickLook } from '../../src/lib/look';

describe('looks', () => {
  it('there are three colour versions, and the default is one of them', () => {
    expect(LOOKS).toEqual(['blue', 'teal', 'orange']);
    expect(LOOKS).toContain(DEFAULT_LOOK);
  });

  it('every look has a label for the switcher', () => {
    for (const look of LOOKS) expect(LOOK_LABELS[look].length).toBeGreaterThan(0);
  });

  it('isLook accepts only known names', () => {
    expect(isLook('teal')).toBe(true);
    expect(isLook('warm')).toBe(false);
    expect(isLook(null)).toBe(false);
    expect(isLook(undefined)).toBe(false);
  });
});

describe('pickLook', () => {
  it('the address wins over the stored choice', () => {
    expect(pickLook('teal', 'blue')).toBe('teal');
  });
  it('the stored choice is used when the address names none', () => {
    expect(pickLook(null, 'orange')).toBe('orange');
    expect(pickLook('nope', 'orange')).toBe('orange');
  });
  it('anything unknown gives the default', () => {
    expect(pickLook('nope', 'nope')).toBe(DEFAULT_LOOK);
    expect(pickLook(null, null)).toBe(DEFAULT_LOOK);
    expect(pickLook(undefined, 'a-look-that-was-deleted')).toBe(DEFAULT_LOOK);
  });
});
