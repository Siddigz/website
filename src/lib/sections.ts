/*
 * The sections of the home page that have a heading, in page order, with the
 * titles from site.yaml that the sections themselves show. The menu lists
 * them. A browser test compares this list with the page itself.
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
  const { sections } = site;
  return [
    { id: 'proof', label: sections.proof },
    { id: 'experience', label: sections.experience },
    { id: 'skills', label: sections.skills },
    { id: 'projects', label: sections.projects },
    { id: 'more-projects', label: sections.moreProjects },
    ...(explainers.length > 0 ? [{ id: 'explainers', label: site.explainers.title }] : []),
    ...(activity ? [{ id: 'activity', label: sections.activity }] : []),
    // About takes its title from its own content file.
    ...(about ? [{ id: 'about', label: about.data.title }] : []),
    { id: 'contact', label: sections.contact },
  ];
}
