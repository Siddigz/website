/*
 * The "More projects" filter, as it appears in the address: `?filter=systems`.
 * Pure, so the page script and the tests share it.
 */
import { CATEGORIES } from '../content/schemas';

export const FILTERS = ['all', ...CATEGORIES] as const;
export type Filter = (typeof FILTERS)[number];

const isFilter = (value: string | null): value is Filter => (FILTERS as readonly (string | null)[]).includes(value);

/** The filter an address asks for. Anything that is not exactly a known one means "all". */
export function parseFilter(search: string): Filter {
  const value = new URLSearchParams(search).get('filter');
  return isFilter(value) ? value : 'all';
}

/** A copy of `url` asking for `filter`. "all" is the address with no filter in it. */
export function withFilter(url: URL, filter: Filter): URL {
  const next = new URL(url);
  if (filter === 'all') next.searchParams.delete('filter');
  else next.searchParams.set('filter', filter);
  return next;
}
