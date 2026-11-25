/*
 * The site's icon: the owner's initials on the accent colour. The letters are
 * turned into outlines while the site is built, so the icon holds shapes
 * only and looks the same on every device.
 */
import { readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';
import { declaredValue, toHex } from './colour';

const SIZE = 64;
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const colour = (name: string) => toHex(declaredValue(tokens, `--color-${name}-light`));
const FONT = {
  name: 'Bricolage Grotesque',
  weight: 800 as const,
  style: 'normal' as const,
  data: readFileSync('node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff'),
};

/** `square` leaves the corners filled, for places that round the icon themselves. */
export async function faviconSvg(initials: string, { square = false } = {}): Promise<string> {
  const mark = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: SIZE,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: square ? 0 : 14,
        background: colour('accent'),
        color: colour('on-accent'),
        fontFamily: FONT.name,
        fontWeight: 800,
        fontSize: 34,
        letterSpacing: -1.5,
      },
      children: initials,
    },
  };
  return satori(mark as never, { width: SIZE, height: SIZE, fonts: [FONT] });
}

export async function faviconPng(initials: string, size: number, options: { square?: boolean } = {}): Promise<Buffer> {
  // Drawn large from the outlines, then brought to size, so small icons stay crisp.
  return sharp(Buffer.from(await faviconSvg(initials, options)), { density: (72 * size * 4) / SIZE })
    .resize(size, size)
    .png()
    .toBuffer();
}
