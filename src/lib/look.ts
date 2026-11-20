/*
 * The three visual directions built for the owner to choose from (stage 2).
 * A look is the value of `data-look` on <html>; each has a stylesheet in
 * src/styles/looks/. Once one is chosen this file and the switcher go away.
 */
export const LOOKS = ['crisp', 'warm', 'editorial'] as const;

export type Look = (typeof LOOKS)[number];

export const DEFAULT_LOOK: Look = 'crisp';

/** Button text in the preview switcher. */
export const LOOK_LABELS: Record<Look, string> = {
  crisp: 'Crisp',
  warm: 'Warm',
  editorial: 'Editorial',
};

export const LOOK_STORAGE_KEY = 'look';

/** Name of the address parameter that selects a look: `/?look=warm`. */
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
