/*
 * Draws a link preview picture: the 1200 by 630 card other sites show when a
 * page of this one is shared. Drawn while the site is built, in the site's
 * own fonts and light-theme colours, which are read from the design tokens.
 */
import { readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';
import { declaredValue, toHex } from './colour';

export type OgCard = {
  title: string;
  /** One sentence under the title. */
  line: string;
  /** A short label above the title, such as an award. */
  badge?: string;
  /** A photo or screenshot for the right-hand side. */
  picture?: Buffer;
  /** Show the whole picture instead of cropping it to fill its frame (charts, screenshots). */
  contain?: boolean;
  /**
   * Which part of a cropped picture to keep, such as 'left top' for a screenshot
   * whose heading is in that corner. Left out, the most eye-catching part is kept,
   * which suits photos.
   */
  position?: string;
  /** The site's address, shown in the corner. */
  address: string;
};

const WIDTH = 1200;
const HEIGHT = 630;
const PICTURE = 440;
const MARGIN = 64;
const GAP = 56;
const FRAME = 8;

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const colour = (name: string) => toHex(declaredValue(tokens, `--color-${name}-light`));
const font = (file: string) => readFileSync(`node_modules/@fontsource/${file}`);
// Static font files, used only here: the pages themselves use the variable ones.
const FONTS = [
  { name: 'Figtree', weight: 400 as const, style: 'normal' as const, data: font('figtree/files/figtree-latin-400-normal.woff') },
  { name: 'Figtree', weight: 600 as const, style: 'normal' as const, data: font('figtree/files/figtree-latin-600-normal.woff') },
  { name: 'Bricolage Grotesque', weight: 800 as const, style: 'normal' as const, data: font('bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff') },
];

type Node = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children?: unknown): Node => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

/** The picture at the size it is drawn, as an address the drawing can hold. */
async function embed(picture: Buffer, contain: boolean, position = 'attention'): Promise<string> {
  const resized = await sharp(picture)
    .rotate()
    // A drawing with no background of its own sits on the frame's white, not on black.
    .flatten({ background: colour('surface') })
    .resize(PICTURE * 2, PICTURE * 2, contain ? { fit: 'contain', background: colour('surface') } : { fit: 'cover', position })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString('base64')}`;
}

export async function renderOg({ title, line, badge, picture, contain = false, position, address }: OgCard): Promise<Buffer> {
  const longestWord = Math.max(...title.split(/\s+/).map((word) => word.length));
  const text = [
    badge &&
      box(
        {
          alignSelf: 'flex-start',
          padding: '8px 20px',
          borderRadius: 999,
          border: `2px solid ${colour('accent')}`,
          color: colour('accent'),
          fontSize: 24,
          fontWeight: 600,
        },
        badge,
      ),
    box(
      {
        display: 'block',
        fontFamily: 'Bricolage Grotesque',
        fontWeight: 800,
        // A long title, or one with a long word in it, steps down a size so it fits its column.
        fontSize: title.length > 26 || longestWord > 11 ? 56 : 76,
        wordBreak: 'break-word',
        lineHeight: 1.08,
        letterSpacing: -2,
        color: colour('text'),
        lineClamp: 3,
      },
      title,
    ),
    box({ display: 'block', fontSize: 28, lineHeight: 1.35, color: colour('text-muted'), lineClamp: 6 }, line),
  ].filter(Boolean);

  // Every size is given outright: the text column gets what the picture leaves, so neither can push the other off the card.
  const pictureSize = PICTURE + 2 * FRAME;
  const textWidth = WIDTH - 2 * MARGIN - (picture ? pictureSize + GAP : 0);
  const card = box({ width: WIDTH, height: HEIGHT, alignItems: 'center', justifyContent: 'center', background: colour('bg'), fontFamily: 'Figtree' }, [
    box({ width: WIDTH - 2 * MARGIN, height: HEIGHT - 2 * MARGIN, gap: GAP, alignItems: 'center' }, [
      box({ flexDirection: 'column', width: textWidth, height: HEIGHT - 2 * MARGIN, justifyContent: 'space-between' }, [
        box({ flexDirection: 'column', gap: 22 }, text),
        box({ fontSize: 26, fontWeight: 600, color: colour('accent') }, address),
      ]),
      picture && {
        type: 'img',
        props: {
          src: await embed(picture, contain, position),
          width: pictureSize,
          height: pictureSize,
          style: { flexShrink: 0, borderRadius: 40, border: `${FRAME}px solid ${colour('surface')}` },
        },
      },
    ].filter(Boolean)),
  ]);

  const svg = await satori(card as never, { width: WIDTH, height: HEIGHT, fonts: FONTS });
  // A limited palette keeps a card with a photo in it small enough to load quickly wherever it is shared.
  return sharp(Buffer.from(svg)).png({ palette: true, quality: 85, effort: 8 }).toBuffer();
}
