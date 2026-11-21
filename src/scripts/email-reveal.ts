/*
 * The Email buttons. Pressing one asks the server for a short-lived token,
 * trades it for the address, then shows the address as a link on every Email
 * button on the page and opens the visitor's mail app. The address is never
 * in the page as built, and neither is the mail link's prefix.
 */
const widgets = [...document.querySelectorAll<HTMLElement>('[data-email]')];
// Put together when the page runs, so the built script does not hold a mail link's prefix as one word.
const MAIL = `${[...'liam'].reverse().join('')}to:`;
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
    link.textContent = address;
    reveal.hidden = true;
    result.hidden = false;
    say(widget, '');
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
    show(address);
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

async function copy(widget: HTMLElement): Promise<void> {
  const link = part<HTMLAnchorElement>(widget, 'link');
  const button = part(widget, 'copy');
  if (!link || !button) return;
  try {
    await navigator.clipboard.writeText(link.textContent ?? '');
    button.textContent = widget.dataset.copied ?? '';
    say(widget, 'copied', widget.dataset.copied);
    window.clearTimeout(timers.get(widget));
    timers.set(
      widget,
      window.setTimeout(() => {
        button.textContent = widget.dataset.copy ?? '';
        say(widget, '');
      }, COPIED_FOR_MS),
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
