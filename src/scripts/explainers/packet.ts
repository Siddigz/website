/*
 * Steps the packet explainer through its eleven stops. The page as built
 * already shows the first stop and holds every history row; this script
 * changes the values, the sentences, which rows show and which stop on the
 * route the packet is beside. Movement is left to CSS, so with reduced motion
 * everything simply changes.
 */
import { HOPS, LAST_STEP, NEW_HEADER_AT, changeLine, changedFields, stateAt, stepLine } from '../../lib/explainers/packet';

const root = document.querySelector<HTMLElement>('[data-packet]');

if (root) {
  const find = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const stops = [...root.querySelectorAll<HTMLElement>('[data-stop]')];
  const token = find('[data-token]');
  const values = [...root.querySelectorAll<HTMLElement>('[data-f]')];
  const rows = [...root.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  const previous = find('[data-previous]');
  const next = find('[data-next]');
  const reset = find('[data-reset]');
  const info = find('[data-info]');
  let step = 0;

  const enable = (button: HTMLElement | null, on: boolean) => button?.setAttribute('aria-disabled', String(!on));
  const usable = (button: HTMLElement | null) => button?.getAttribute('aria-disabled') !== 'true';

  /** Moves the packet down to the stop it is at. Stops differ in height where their words wrap, so this is measured. */
  function place(): void {
    const top = (stop?: HTMLElement) => stop?.querySelector('.mark')?.getBoundingClientRect().top;
    const first = top(stops[0]);
    const here = top(stops[step]);
    if (first !== undefined && here !== undefined) token?.style.setProperty('--packet-y', `${Math.round(here - first)}px`);
  }

  function show(to: number): void {
    const forward = to === step + 1;
    step = to;
    const state = stateAt(step);
    const changed: string[] = changedFields(step);

    for (const value of values) {
      const field = value.dataset.f as keyof typeof state;
      value.textContent = state[field];
      value.toggleAttribute('data-changed', changed.includes(field));
    }

    const stepText = find('[data-step]');
    const captionText = find('[data-caption-text]');
    const changedLine = find('[data-changed-line]');
    if (stepText) stepText.textContent = stepLine(step);
    if (captionText) captionText.textContent = HOPS[step]!.caption;
    if (changedLine) changedLine.textContent = changeLine(step);

    // The note about address translation belongs to the home router alone.
    const nat = find('[data-nat]');
    const verdict = find('[data-verdict]');
    if (nat) nat.hidden = step !== 1;
    if (verdict) verdict.hidden = step !== LAST_STEP;
    if (info) info.textContent = step === LAST_STEP ? (info.dataset.delivered ?? '') : '';

    rows.forEach((row, index) => {
      row.hidden = index > step;
      row.toggleAttribute('data-current', index === step);
    });

    stops.forEach((stop, index) => {
      if (index === step) stop.setAttribute('aria-current', 'step');
      else stop.removeAttribute('aria-current');
    });
    place();

    // At the server, the Ethernet and IP headers have been read and removed.
    const ethernet = find('[data-seg="eth"]');
    const ip = find('[data-seg="ip"]');
    for (const segment of [ethernet, ip]) segment?.toggleAttribute('data-gone', step === LAST_STEP);
    // Where a router swaps the Ethernet header, the bar shows the old one leave and the new one arrive.
    if (ethernet) {
      ethernet.removeAttribute('data-swap');
      if (forward && step !== LAST_STEP && NEW_HEADER_AT.includes(step)) {
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

  // Words wrap differently at another width, so the stops move: the packet follows its stop.
  const route = find('[data-route]');
  if (route) new ResizeObserver(place).observe(route);
}
