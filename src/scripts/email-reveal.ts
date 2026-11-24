/*
 * The Email buttons. Pressing one asks the server for a short-lived token,
 * trades it for the address, then turns every Email button on the page into
 * the address (a link that opens the mail app) with a small part after it
 * that copies it. The pressed button widens into its new shape; where that
 * needs a new line, what is below glides down. The address is never in the
 * page as built: only this script's empty mail prefix is.
 */
const widgets = [...document.querySelectorAll<HTMLElement>('[data-email]')];
const MAIL = 'mailto:';
const COPIED_FOR_MS = 2000;
const TIMEOUT_MS = 10_000;
let busy = false;

const part = <T extends HTMLElement>(widget: HTMLElement, name: string) => widget.querySelector<T>(`[data-email-${name}]`);

function say(widget: HTMLElement, kind: 'failed' | 'copied' | '', text = ''): void {
  const status = part(widget, 'status');
  if (!status) return;
  status.dataset.kind = kind;
  status.textContent = text;
}

async function post(path: string, body?: unknown): Promise<any> {
  const response = await fetch(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    // A server that never answers must not leave the buttons dead.
    signal: 'timeout' in AbortSignal ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function show(address: string): void {
  for (const widget of widgets) {
    const reveal = part(widget, 'reveal');
    const result = part(widget, 'result');
    if (!reveal || !result) continue;
    // The link exists only from here on: the page as built has no empty link in it.
    const link = part<HTMLAnchorElement>(widget, 'link') ?? document.createElement('a');
    link.dataset.emailLink = '';
    result.prepend(link);
    link.href = MAIL + address;
    // Where the address is too long for one line, it breaks after the at sign, never in the middle of a word.
    const at = address.indexOf('@') + 1;
    link.replaceChildren(address.slice(0, at), document.createElement('wbr'), address.slice(at));
    // Named in one piece, so the break point is never read out as a gap.
    link.setAttribute('aria-label', address);
    reveal.hidden = true;
    result.hidden = false;
    say(widget, '');
  }
}

/** How long and how a change of shape moves, from the design tokens. Nothing, for visitors who asked for less motion. */
function motion(): KeyframeAnimationOptions | undefined {
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return undefined;
  const style = getComputedStyle(document.documentElement);
  const value = style.getPropertyValue('--duration-base').trim();
  const duration = (parseFloat(value) || 0) * (value.endsWith('ms') ? 1 : 1000);
  return duration > 0 ? { duration, easing: style.getPropertyValue('--ease-out').trim() || 'ease-out' } : undefined;
}

/** Moves the pressed button into its new shape. Garnish: the address is already showing when this runs. */
function animate(widget: HTMLElement, from: { width: number; height: number }): void {
  const how = motion();
  const result = part(widget, 'result');
  const link = part(widget, 'link');
  const row = widget.closest<HTMLElement>('ul');
  if (!how || !result || !link) return;
  const to = { width: result.offsetWidth, height: row?.offsetHeight ?? 0 };
  link.animate({ opacity: [0, 1] }, how);
  if (row && to.height !== from.height) {
    // The address needed a line of its own: what is below glides down to make room.
    row.animate({ blockSize: [`${from.height}px`, `${to.height}px`] }, how);
  } else if (from.width && to.width > from.width) {
    // Same line: the button widens from "Email" to the address, and its neighbours slide along.
    result.classList.add('opening');
    const settle = () => result.classList.remove('opening');
    try {
      const widen = result.animate({ inlineSize: [`${from.width}px`, `${to.width}px`] }, how);
      widen.addEventListener('finish', settle);
      widen.addEventListener('cancel', settle);
    } catch (error) {
      settle();
      throw error;
    }
  }
}

async function reveal(widget: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  const button = part(widget, 'reveal');
  button?.setAttribute('aria-busy', 'true');
  say(widget, '');
  let address: unknown;
  try {
    const { token } = await post('/api/contact/token');
    ({ address } = await post('/api/contact/address', { token }));
    if (typeof address !== 'string' || !address) throw new Error('no address');
  } catch {
    say(widget, 'failed', widget.dataset.failed);
    return;
  } finally {
    busy = false;
    button?.removeAttribute('aria-busy');
  }

  // Whether the visitor is still where they pressed: if they have moved on while waiting, they are left there.
  const stayed = document.activeElement === button || document.activeElement === document.body || !document.activeElement;
  // The row of buttons the pressed one sits in, as it is before the address takes the button's place.
  const row = widget.closest<HTMLElement>('ul');
  const from = { width: button?.offsetWidth ?? 0, height: row?.offsetHeight ?? 0 };
  show(address);
  const link = part<HTMLAnchorElement>(widget, 'link');
  // The pressed button is gone, so focus moves to the link that took its place.
  if (stayed) link?.focus();
  // Opens the visitor's mail app, as a plain mail link would.
  link?.click();
  try {
    animate(widget, from);
  } catch {
    // A browser that cannot animate shows the address at once, which is all that matters.
  }
}

const timers = new WeakMap<HTMLElement, number>();

/** For a moment after copying, the copy part shows a tick and "Copied" is read out once. Its own name stays "Copy". */
function mark(widget: HTMLElement, done: boolean): void {
  part(widget, 'copy')?.toggleAttribute('data-done', done);
  say(widget, done ? 'copied' : '', done ? widget.dataset.copied : '');
}

async function copy(widget: HTMLElement): Promise<void> {
  const link = part<HTMLAnchorElement>(widget, 'link');
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link.textContent ?? '');
    mark(widget, true);
    window.clearTimeout(timers.get(widget));
    timers.set(
      widget,
      window.setTimeout(() => mark(widget, false), COPIED_FOR_MS),
    );
  } catch {
    // The clipboard was refused. Selecting the address leaves it one keystroke from copied.
    getSelection()?.selectAllChildren(link);
  }
}

for (const widget of widgets) {
  part(widget, 'reveal')?.addEventListener('click', () => void reveal(widget));
  part(widget, 'copy')?.addEventListener('click', () => void copy(widget));
}
