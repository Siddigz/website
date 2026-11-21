/*
 * The "More projects" filter. Pressing a button hides the rows of other
 * categories and writes the choice into the address, in place, so the address
 * can be shared and Back still leaves the page. Where the browser can animate
 * between two states of a page, and the visitor allows motion, the rows move.
 */
import { parseFilter, withFilter, type Filter } from '../lib/filter';

const group = document.querySelector<HTMLElement>('[data-filter]');
const status = document.querySelector<HTMLElement>('[data-filter-status]');
const buttons = [...(group?.querySelectorAll<HTMLButtonElement>('button[data-filter-value]') ?? [])];
const rows = [...document.querySelectorAll<HTMLElement>('#more-projects .row[data-category]')];
const motionAllowed = matchMedia('(prefers-reduced-motion: no-preference)');
let latest = 0;

function show(filter: Filter): void {
  let shown = 0;
  for (const row of rows) {
    row.hidden = filter !== 'all' && row.dataset.category !== filter;
    if (!row.hidden) shown += 1;
  }
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filterValue === filter));
  if (status && group) {
    status.textContent = (group.dataset.status ?? '').replace('{n}', String(shown)).replace('{total}', String(rows.length));
  }
}

function choose(filter: Filter): void {
  history.replaceState(history.state, '', withFilter(new URL(location.href), filter));
  if (!motionAllowed.matches || !document.startViewTransition) {
    show(filter);
    return;
  }
  // Each row needs its own name for the length of the transition, and the
  // page as a whole is kept out of it so only the rows move.
  rows.forEach((row, index) => (row.style.viewTransitionName = `filter-row-${index}`));
  document.documentElement.dataset.filtering = '';
  // A second press can start before the first change has finished. Only the
  // latest one tidies up, so an earlier one cannot strip what it still needs.
  const mine = (latest += 1);
  const done = () => {
    if (mine !== latest) return;
    rows.forEach((row) => row.style.removeProperty('view-transition-name'));
    delete document.documentElement.dataset.filtering;
  };
  document.startViewTransition(() => show(filter)).finished.then(done, done);
}

if (group) {
  // An address that names a button's category arrives filtered. Anything else shows every row.
  const asked = parseFilter(location.search);
  if (asked !== 'all' && buttons.some((button) => button.dataset.filterValue === asked)) show(asked);
  for (const button of buttons) {
    button.addEventListener('click', () => choose(parseFilter(`?filter=${button.dataset.filterValue ?? ''}`)));
  }
}
