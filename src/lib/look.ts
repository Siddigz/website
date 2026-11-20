/*
 * Stage 2. The owner chose the warm look (src/styles/look.css) and is now
 * choosing its accent colour from three versions. A version is the value of
 * `data-look` on <html>; each has a stylesheet in src/styles/looks/. Once one
 * is chosen this file and the switcher go away.
 */
export const LOOKS = ['blue', 'teal', 'orange'] as const;

export type Look = (typeof LOOKS)[number];

export const DEFAULT_LOOK: Look = 'blue';

/** Button text in the preview switcher. */
export const LOOK_LABELS: Record<Look, string> = {
  blue: 'Blue',
  teal: 'Teal',
  orange: 'Orange',
};

export const LOOK_STORAGE_KEY = 'look';

/** Name of the address parameter that selects a version: `/?look=teal`. */
export const LOOK_PARAM = 'look';

export function isLook(value: unknown): value is Look {
  return (LOOKS as readonly unknown[]).includes(value);
}

/** The look to show: the one in the address, else the stored one, else the default. */
export function pickLook(fromAddress: unknown, stored: unknown): Look {
  if (isLook(fromAddress)) return fromAddress;
  if (isLook(stored)) return stored;
  return DEFAULT_LOOK;
}
