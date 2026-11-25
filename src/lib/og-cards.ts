/*
 * What goes on each link preview picture, taken from the same content the
 * pages use: the home card from site.yaml, a project's card from its file.
 */
import type { CollectionEntry } from 'astro:content';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';
import tokens from '../styles/tokens.css?raw';
import { declaredValue, toHex } from './colour';
import { DRAWINGS, drawingSvg, type Paint } from './explainers/drawings';
import type { OgCard } from './og';
import { getSite } from './site';

const SITE_FILE = 'src/content/site.yaml';

/** The picture a content file names, as a file on disk. Content files give it relative to themselves. */
function pictureBeside(file: string, relative: string | undefined): Buffer | undefined {
  return relative ? readFileSync(resolve(dirname(file), relative)) : undefined;
}

/** The site's address without "https://", as people type it. */
async function address(): Promise<string> {
  return new URL((await getSite()).url).host;
}

export async function homeCard(): Promise<OgCard> {
  const site = await getSite();
  const photo: string | undefined = parse(readFileSync(SITE_FILE, 'utf8')).main.photo?.src;
  return { title: site.fullName, line: site.pitch, picture: pictureBeside(SITE_FILE, photo), address: await address() };
}

export async function projectCard(project: CollectionEntry<'projects'>): Promise<OgCard> {
  const { data, filePath } = project;
  // The cover as the content file names it; the collection only keeps where the built copy goes.
  const cover = filePath ? /^cover:\s*(\S+)\s*$/m.exec(readFileSync(filePath, 'utf8'))?.[1] : undefined;
  return {
    title: data.title,
    line: data.oneLiner,
    badge: data.award && `${data.award.name} · ${data.award.event}`,
    picture: filePath ? pictureBeside(filePath, cover) : undefined,
    contain: data.coverFit === 'contain',
    position: data.previewPosition,
    address: await address(),
  };
}

// The light theme's colours, as the preview pictures need them.
const colour = (name: string) => toHex(declaredValue(tokens, `--color-${name}-light`));

/** Two colours mixed: `share` of the first, the rest of the second. Close enough to the page's own tints for a small picture. */
function mix(first: string, second: string, share: number): string {
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  return `#${[0, 1, 2].map((index) => Math.round(channel(first, index) * share + channel(second, index) * (1 - share)).toString(16).padStart(2, '0')).join('')}`;
}

/** How each part of an explainer's drawing is painted on its preview picture: the same choices as on the page. */
function drawingPaint(): Record<string, Paint> {
  const surface = colour('surface');
  const muted = colour('text-muted');
  // Each layer of the packet in its own colour, as the tokens name them.
  const layerColours = { eth: colour('accent'), ip: colour('live'), tcp: colour('violet'), data: muted };
  return {
    trail: { stroke: muted, width: 2, opacity: 0.5 },
    fiber: { stroke: colour('amber'), width: 4 },
    stop: { fill: colour('bg'), stroke: muted, width: 2 },
    'stop-done': { fill: colour('text') },
    'stop-now': { fill: colour('accent') },
    ...Object.fromEntries(
      Object.entries(layerColours).flatMap(([name, hue]): [string, Paint][] => [
        [`layer-${name}`, { fill: mix(hue, surface, 0.12), stroke: hue, width: 2 }],
        [`label-${name}`, { fill: hue }],
      ]),
    ),
    value: { fill: muted, opacity: 0.55 },
    changed: { fill: mix(colour('amber'), surface, 0.3), stroke: colour('amber'), width: 1.2 },
    level: { stroke: muted, width: 1, dash: '4 4', opacity: 0.6 },
    threshold: { stroke: colour('wrong'), width: 1, dash: '2 3' },
    sent: { stroke: muted },
    received: { stroke: colour('accent'), width: 2 },
    dot: { fill: colour('accent') },
    'dot-bad': { fill: colour('wrong') },
    cross: { stroke: colour('wrong'), width: 2 },
  };
}

export async function explainerCard(explainer: CollectionEntry<'explainers'>): Promise<OgCard> {
  const draw = DRAWINGS[explainer.id];
  // Drawn large from the shapes, so it stays crisp at the size the card shows it.
  const picture = draw ? await sharp(Buffer.from(drawingSvg(draw(), drawingPaint())), { density: 288 }).png().toBuffer() : undefined;
  return { title: explainer.data.title, line: explainer.data.summary, picture, contain: true, address: await address() };
}
