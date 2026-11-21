import { getEntry } from 'astro:content';

/** The profile links, in the one order every part of the site shows them. */
const PROFILE_LINKS = [
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' },
] as const;

// Every recording, as the address its file gets in the build. Never inlined
// into the page, however small, so nothing is downloaded before it is asked for.
const RECORDINGS = import.meta.glob<string>('../assets/audio/*', { eager: true, query: '?no-inline', import: 'default' });

function recording(fileName: string): string {
  const address = RECORDINGS[`../assets/audio/${fileName}`];
  if (!address) throw new Error(`src/content/site.yaml names a recording that is not in src/assets/audio/: ${fileName}`);
  return address;
}

/** The site-wide settings from src/content/site.yaml, with the full name joined. */
export async function getSite() {
  const entry = await getEntry('site', 'main');
  if (!entry) throw new Error('src/content/site.yaml needs an entry keyed `main`');
  return {
    ...entry.data,
    fullName: `${entry.data.name.first} ${entry.data.name.last}`,
    nameAudio: { first: recording(entry.data.name.audio.first), last: recording(entry.data.name.audio.last) },
    profileLinks: PROFILE_LINKS.map(({ key, label }) => ({ label, href: entry.data.links[key] })),
  };
}
