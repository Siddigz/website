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

/** Shows the address everywhere, and moves the pressed button into its new shape. */
function open(widget: HTMLElement, address: string): void {
  const result = part(widget, 'result');
  // The row of buttons the pressed one sits in.
  const row = widget.closest<HTMLElement>('ul');
  const from = { width: part(widget, 'reveal')?.offsetWidth ?? 0, height: row?.offsetHeight ?? 0 };
  show(address);
  const how = motion();
  const link = part(widget, 'link');
  if (!how || !result || !link) return;
  const to = { width: result.offsetWidth, height: row?.offsetHeight ?? 0 };
  link.animate({ opacity: [0, 1] }, how);
  if (row && to.height !== from.height) {
    // The address needed a line of its own: what is below glides down to make room.
    row.animate({ blockSize: [`${from.height}px`, `${to.height}px`] }, how);
  } else if (from.width && to.width > from.width) {
    // Same line: the button widens from "Email" to the address, and its neighbours slide along.
    result.classList.add('opening');
    const widen = result.animate({ inlineSize: [`${from.width}px`, `${to.width}px`] }, how);
    const settle = () => result.classList.remove('opening');
    widen.addEventListener('finish', settle);
    widen.addEventListener('cancel', settle);
  }
}

async function reveal(widget: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  say(widget, '');
  try {
    const { token } = await post('/api/contact/token');
    const { address } = await post('/api/contact/address', { token });
    if (typeof address !== 'string' || !address) throw new Error('no address');
    open(widget, address);
    // The pressed button is gone, so focus moves to the link that took its place.
    const link = part<HTMLAnchorElement>(widget, 'link');
    link?.focus();
    // Opens the visitor's mail app, as a plain mail link would.
    link?.click();
  } catch {
    say(widget, 'failed', widget.dataset.failed);
  } finally {
    busy = false;
  }
}

const timers = new WeakMap<HTMLElement, number>();

/** The copy part says what it does in its name, and for a moment after copying shows a tick and says "Copied". */
function mark(widget: HTMLElement, done: boolean): void {
  const button = part(widget, 'copy');
  if (!button) return;
  button.toggleAttribute('data-done', done);
  button.setAttribute('aria-label', (done ? widget.dataset.copied : widget.dataset.copy) ?? '');
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
