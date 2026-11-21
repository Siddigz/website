/*
 * The sections of the home page that have a heading, in page order. The menu
 * lists them. A browser test compares this list with the page itself, so the
 * two cannot drift apart.
 */
import { getEntry } from 'astro:content';
import { getActivity } from './activity';
import { getExplainers } from './explainer-list';
import { getSite } from './site';

export async function homeSections(): Promise<{ id: string; label: string }[]> {
  const about = await getEntry('about', 'about');
  const activity = await getActivity();
  const explainers = await getExplainers();
  const site = await getSite();
  return [
    { id: 'proof', label: 'Highlights' },
    { id: 'experience', label: 'Experience' },
    { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Featured projects' },
    { id: 'more-projects', label: 'More projects' },
    ...(explainers.length > 0 ? [{ id: 'explainers', label: site.explainers.title }] : []),
    ...(activity ? [{ id: 'activity', label: 'GitHub activity' }] : []),
    { id: 'about', label: about?.data.title ?? 'About' },
    { id: 'contact', label: 'Contact' },
  ];
}
