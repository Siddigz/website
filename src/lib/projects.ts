/** The parts of a project entry the ordering helpers need. */
export type ProjectLike = { id: string; data: { featured?: number; date?: string; order?: number } };

/** Featured projects, in the order their `featured` numbers give. */
export function featuredProjects<T extends ProjectLike>(entries: T[]): T[] {
  return entries
    .filter((entry) => entry.data.featured !== undefined)
    .sort((a, b) => (a.data.featured ?? 0) - (b.data.featured ?? 0));
}

/**
 * Everything else, by its `order` number. Any without one follow, newest first, with undated
 * projects last. Ties go to the id, so the order is stable.
 */
export function moreProjects<T extends ProjectLike>(entries: T[]): T[] {
  return entries
    .filter((entry) => entry.data.featured === undefined)
    .sort(
      (a, b) =>
        // Two projects with no order give NaN here, which falls through to the date.
        (a.data.order ?? Infinity) - (b.data.order ?? Infinity) ||
        (b.data.date ?? '').localeCompare(a.data.date ?? '') ||
        a.id.localeCompare(b.id),
    );
}

/** The featured project after `id`, wrapping from the last back to the first. */
export function nextFeatured<T extends ProjectLike>(entries: T[], id: string): T {
  const featured = featuredProjects(entries);
  const index = featured.findIndex((entry) => entry.id === id);
  const next = featured[(index + 1) % featured.length];
  if (index === -1 || !next) throw new Error(`"${id}" is not a featured project`);
  return next;
}
