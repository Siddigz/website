import { describe, it, expect } from 'vitest';
import { DEFAULT_LOOK, LOOKS, LOOK_LABELS, isLook, pickLook } from '../../src/lib/look';

describe('looks', () => {
  it('there are three, and the default is one of them', () => {
    expect(LOOKS).toEqual(['crisp', 'warm', 'editorial']);
    expect(LOOKS).toContain(DEFAULT_LOOK);
  });

  it('every look has a label for the switcher', () => {
    for (const look of LOOKS) expect(LOOK_LABELS[look].length).toBeGreaterThan(0);
  });

  it('isLook accepts only known names', () => {
    expect(isLook('warm')).toBe(true);
    expect(isLook('neutral')).toBe(false);
    expect(isLook(null)).toBe(false);
    expect(isLook(undefined)).toBe(false);
  });
});

describe('pickLook', () => {
  it('the address wins over the stored choice', () => {
    expect(pickLook('warm', 'crisp')).toBe('warm');
  });
  it('the stored choice is used when the address names none', () => {
    expect(pickLook(null, 'editorial')).toBe('editorial');
    expect(pickLook('nope', 'editorial')).toBe('editorial');
  });
  it('anything unknown gives the default', () => {
    expect(pickLook('nope', 'nope')).toBe(DEFAULT_LOOK);
    expect(pickLook(null, null)).toBe(DEFAULT_LOOK);
    expect(pickLook(undefined, 'a-look-that-was-deleted')).toBe(DEFAULT_LOOK);
  });
});
