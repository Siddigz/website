/*
 * What goes on each link preview picture, taken from the same content the
 * pages use: the home card from site.yaml, a project's card from its file.
 */
import type { CollectionEntry } from 'astro:content';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
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
    address: await address(),
  };
}
