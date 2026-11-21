/*
 * Everything the command menu can jump to, in the order it is listed.
 */
import type { CommandItem } from './command';

type Input = {
  /** Home page sections, in page order. */
  sections: { id: string; label: string }[];
  projects: { title: string; href: string; keywords: string }[];
  explainers: { title: string; href: string }[];
  links: { label: string; href: string }[];
  /** The theme switch's two labels. The page shows the one that applies. */
  theme: { toDark: string; toLight: string };
};

/** Lower-case letters, digits and hyphens only, so the result is safe in an element id. */
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function commandItems({ sections, projects, explainers, links, theme }: Input): CommandItem[] {
  return [
    // Addresses on the home page, so a section can be reached from any page.
    ...sections.map(({ id, label }): CommandItem => ({ id: `command-section-${slug(id)}`, group: 'sections', label, href: `/#${id}` })),
    ...projects.map(({ title, href, keywords }, index): CommandItem => ({
      id: `command-project-${index}-${slug(title)}`,
      group: 'projects',
      label: title,
      href,
      keywords,
    })),
    ...explainers.map(({ title, href }, index): CommandItem => ({ id: `command-explainer-${index}`, group: 'explainers', label: title, href })),
    ...links.map(({ label, href }): CommandItem => ({ id: `command-link-${slug(label)}`, group: 'links', label, href })),
    { id: 'command-theme', group: 'theme', label: theme.toDark, action: 'toggle-theme', keywords: theme.toLight },
  ];
}
