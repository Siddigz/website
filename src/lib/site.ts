import { getEntry } from 'astro:content';

/** The site-wide settings from src/content/site.yaml, with the full name joined. */
export async function getSite() {
  const entry = await getEntry('site', 'main');
  if (!entry) throw new Error('src/content/site.yaml needs an entry keyed `main`');
  return { ...entry.data, fullName: `${entry.data.name.first} ${entry.data.name.last}` };
}
