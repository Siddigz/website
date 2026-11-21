/*
 * The command menu's search and keyboard movement. Pure, so the page script
 * and the tests share it.
 */
export type CommandGroup = 'sections' | 'projects' | 'explainers' | 'links' | 'theme';

export type CommandItem = {
  /** Unique, and usable as an element id. */
  id: string;
  group: CommandGroup;
  label: string;
  href?: string;
  action?: 'toggle-theme';
  /** Extra words the search should find this item by. */
  keywords?: string;
};

/** Lower case, with accents removed: "Écö" becomes "eco". */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The items that hold every word of `query`, in their original order. An empty query keeps all. */
export function filterItems(items: CommandItem[], query: string): CommandItem[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const text = plain(`${item.label} ${item.keywords ?? ''}`);
    return words.every((word) => text.includes(word));
  });
}

/** The next active position among `count` items, wrapping at both ends. -1 when there are none. */
export function moveActive(count: number, current: number, step: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return step === 1 ? 0 : count - 1;
  return (current + step + count) % count;
}
