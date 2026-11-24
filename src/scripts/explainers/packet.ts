/*
 * Steps the packet demo through its eleven stops. The page as built already
 * shows the first stop and holds every row of the journey; this script changes
 * the values, the words, the device, the marks on each layer and which rows
 * show. Movement is left to CSS, so with reduced motion everything simply changes.
 */
import { HOPS, LAST_STEP, LAYERS, MARK_TEXT, changedFields, markFor, neighbours, stateAt, stepLine } from '../../lib/explainers/packet';

const root = document.querySelector<HTMLElement>('[data-packet]');

if (root) {
  const find = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll<T>(selector)];
  const stops = all('[data-stop]');
  const values = all('[data-f]');
  const glyphs = all('[data-glyph]');
  const rows = all<HTMLTableRowElement>('tbody tr');
  const previous = find('[data-previous]');
  const next = find('[data-next]');
  const reset = find('[data-reset]');
  let step = 0;

  const enable = (button: HTMLElement | null, on: boolean) => button?.setAttribute('aria-disabled', String(!on));
  const usable = (button: HTMLElement | null) => button?.getAttribute('aria-disabled') !== 'true';
  const write = (selector: string, text: string) => {
    const element = find(selector);
    if (element) element.textContent = text;
  };

  function show(to: number): void {
    const forward = to === step + 1;
    step = to;
    const hop = HOPS[step]!;
    const state = stateAt(step);
    const changed: string[] = changedFields(step);
    const around = neighbours(step);

    for (const value of values) {
      const field = value.dataset.f as keyof typeof state;
      value.textContent = state[field];
      value.toggleAttribute('data-changed', changed.includes(field));
    }

    stops.forEach((stop, index) => {
      if (index === step) stop.setAttribute('aria-current', 'step');
      else stop.removeAttribute('aria-current');
      stop.toggleAttribute('data-passed', index < step);
    });

    write('[data-step]', stepLine(step));
    write('[data-caption-text]', hop.caption);
    write('[data-name]', hop.name);
    write('[data-does]', hop.does);
    write('[data-from]', around.from);
    write('[data-next-name]', around.next);
    for (const glyph of glyphs) glyph.toggleAttribute('hidden', glyph.dataset.glyph !== hop.kind);

    for (const layer of LAYERS) write(`[data-mark="${layer}"]`, MARK_TEXT[markFor(step, layer)]);

    rows.forEach((row, index) => {
      row.hidden = index > step;
      row.toggleAttribute('data-current', index === step);
    });

    // Where a router replaces the Ethernet layer, its line shows the old one leave and the new one arrive.
    const ethernet = find('[data-head="eth"]');
    if (ethernet) {
      ethernet.removeAttribute('data-swap');
      if (forward && markFor(step, 'eth') === 'rewritten') {
        void ethernet.offsetWidth; // so the animation starts again
        ethernet.setAttribute('data-swap', '');
      }
    }

    enable(previous, step > 0);
    enable(next, step < LAST_STEP);
  }

  // The buttons stay focusable at the ends of the journey, so focus is never lost; they just do nothing there.
  previous?.addEventListener('click', () => usable(previous) && show(step - 1));
  next?.addEventListener('click', () => usable(next) && show(step + 1));
  reset?.addEventListener('click', () => show(0));
}
