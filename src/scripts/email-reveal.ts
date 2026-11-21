/*
 * The Email buttons. Pressing one asks the server for a short-lived token,
 * trades it for the address, then shows the address in a small box that hangs
 * under the button (with a Copy button) and opens the visitor's mail app.
 * The box floats over the page, so opening it moves nothing. The address is
 * never in the page as built: only this script's empty mail prefix is.
 */
const widgets = [...document.querySelectorAll<HTMLElement>('[data-email]')];
const MAIL = 'mailto:';
const COPIED_FOR_MS = 2000;
const GAP = 8;
// Browsers that can float a box over the page and close it on Escape or a press elsewhere.
const floats = Object.hasOwn(HTMLElement.prototype, 'popover');
let address: string | undefined;
let busy = false;

const part = <T extends HTMLElement>(widget: HTMLElement, name: string) => widget.querySelector<T>(`[data-email-${name}]`);

/** Read out by screen readers. What is shown is in the box and on the Copy button. */
function say(widget: HTMLElement, text = ''): void {
  const status = part(widget, 'status');
  if (status) status.textContent = text;
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

/** How tall the page was before a box opened, so a box never makes it taller. */
let pageHeight = 0;

/**
 * Puts the box just under its button, kept inside the screen's width. Where
 * that would run past the end of the page (the Email button in Contact, at the
 * very bottom), it goes just above the button instead.
 */
function place(widget: HTMLElement): void {
  const button = part(widget, 'reveal');
  const box = part(widget, 'result');
  if (!button || !box || !floats) return;
  const at = button.getBoundingClientRect();
  const edge = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || GAP;
  const left = Math.max(edge, Math.min(at.left, document.documentElement.clientWidth - edge - box.offsetWidth));
  const below = at.bottom + scrollY + GAP;
  const top = below + box.offsetHeight > pageHeight ? at.top + scrollY - GAP - box.offsetHeight : below;
  box.style.setProperty('--email-x', `${Math.round(left + scrollX)}px`);
  box.style.setProperty('--email-y', `${Math.round(top)}px`);
}

function open(widget: HTMLElement): void {
  const box = part(widget, 'result');
  if (!box) return;
  if (floats) {
    if (!box.matches(':popover-open')) {
      pageHeight = document.documentElement.scrollHeight;
      box.showPopover();
    }
    place(widget);
  } else {
    box.hidden = false;
  }
}

/** Fills one widget's box with either the address and Copy, or a line saying it could not be fetched. */
function fill(widget: HTMLElement, problem?: string): void {
  const box = part(widget, 'result');
  const copy = part(widget, 'copy');
  const line = part(widget, 'problem');
  if (!box || !copy || !line) return;
  let link = part<HTMLAnchorElement>(widget, 'link');
  if (address && !problem) {
    // The link exists only from here on: the page as built has no empty link in it.
    if (!link) {
      link = document.createElement('a');
      link.dataset.emailLink = '';
      box.prepend(link);
    }
    link.href = MAIL + address;
    link.textContent = address;
  }
  if (link) link.hidden = Boolean(problem);
  copy.hidden = Boolean(problem);
  line.hidden = !problem;
  line.textContent = problem ?? '';
}

async function reveal(widget: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  say(widget);
  try {
    const { token } = await post('/api/contact/token');
    const answer = await post('/api/contact/address', { token });
    if (typeof answer.address !== 'string' || !answer.address) throw new Error('no address');
    address = answer.address;
    for (const each of widgets) {
      fill(each);
      // From now on the button simply opens and closes its box, the way the browser does it for any such pair.
      const button = part<HTMLButtonElement>(each, 'reveal');
      const box = part(each, 'result');
      if (floats && button && box) button.popoverTargetElement = box;
    }
    open(widget);
    const link = part<HTMLAnchorElement>(widget, 'link');
    link?.focus();
    // Opens the visitor's mail app, as a plain mail link would.
    link?.click();
  } catch {
    fill(widget, widget.dataset.failed);
    open(widget);
    say(widget, widget.dataset.failed);
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
    say(widget, widget.dataset.copied);
    window.clearTimeout(timers.get(widget));
    timers.set(
      widget,
      window.setTimeout(() => {
        button.textContent = widget.dataset.copy ?? '';
        say(widget);
      }, COPIED_FOR_MS),
    );
  } catch {
    // The clipboard was refused. Selecting the address leaves it one keystroke from copied.
    getSelection()?.selectAllChildren(link);
  }
}

for (const widget of widgets) {
  const box = part(widget, 'result');
  if (box) {
    // The floating kind hides itself until opened; the in-line kind keeps `hidden` until then.
    if (floats) box.hidden = false;
    else box.classList.add('in-line');
    // Opened by the button itself (after the first time): put it under the button.
    box.addEventListener('beforetoggle', (event) => {
      if ((event as ToggleEvent).newState === 'open') pageHeight = document.documentElement.scrollHeight;
    });
    box.addEventListener('toggle', (event) => {
      if ((event as ToggleEvent).newState === 'open') place(widget);
    });
  }
  part(widget, 'reveal')?.addEventListener('click', () => {
    // Once the address is known the browser opens and closes the box by itself.
    if (address && floats) return;
    if (address) open(widget);
    else void reveal(widget);
  });
  part(widget, 'copy')?.addEventListener('click', () => void copy(widget));
}

// The box is placed for the screen as it was when it opened. If the window changes size, it closes.
window.addEventListener('resize', () => {
  for (const widget of widgets) {
    const box = part(widget, 'result');
    if (floats && box?.matches(':popover-open')) box.hidePopover();
  }
});
