/*
 * The command menu: a dialog with a search box over a list of places to jump
 * to. The list is in the page as built; this script filters it, moves the
 * active entry with the arrow keys and opens the chosen one.
 */
import { filterItems, moveActive, type CommandItem } from '../lib/command';

const dialog = document.querySelector<HTMLDialogElement>('dialog#command-menu');
const input = dialog?.querySelector<HTMLInputElement>('[role="combobox"]');
const empty = dialog?.querySelector<HTMLElement>('[data-menu-empty]');
const openers = [...document.querySelectorAll<HTMLButtonElement>('[data-menu-open]')];

if (dialog && input) {
  const options = [...dialog.querySelectorAll<HTMLElement>('[role="option"]')];
  const groups = [...dialog.querySelectorAll<HTMLElement>('[role="group"]')];
  const items = options.map(
    (option): CommandItem => ({
      id: option.id,
      group: 'sections',
      label: option.textContent ?? '',
      keywords: option.dataset.keywords,
    }),
  );
  let shown: HTMLElement[] = options;
  let active = -1;

  const setActive = (index: number) => {
    active = index;
    shown.forEach((option, position) => option.setAttribute('aria-selected', String(position === index)));
    const current = shown[index];
    input.setAttribute('aria-activedescendant', current?.id ?? '');
    // Only the list inside the menu moves, and only as far as it must.
    current?.scrollIntoView({ block: 'nearest' });
  };

  const search = (query: string) => {
    const matching = new Set(filterItems(items, query).map((item) => item.id));
    for (const option of options) {
      option.hidden = !matching.has(option.id);
      option.setAttribute('aria-selected', 'false');
    }
    for (const group of groups) group.hidden = !group.querySelector('[role="option"]:not([hidden])');
    shown = options.filter((option) => !option.hidden);
    if (empty) empty.hidden = shown.length > 0;
    setActive(shown.length > 0 ? 0 : -1);
  };

  const open = () => {
    if (dialog.open) return;
    input.value = '';
    search('');
    dialog.showModal();
  };

  for (const opener of openers) {
    opener.addEventListener('click', () => {
      // Safari does not focus a button when it is clicked, and the browser
      // returns focus to wherever it was when the menu closes.
      opener.focus({ preventScroll: true });
      open();
    });
  }

  // Ctrl+K, or ⌘K on Apple keyboards, from anywhere on the page.
  document.addEventListener('keydown', (event) => {
    // The K key itself, whatever its layout prints on it (on an Arabic layout it types ن),
    // or any key that types "k". Some tools send key events with no key at all.
    const isK = event.code === 'KeyK' || event.key?.toLowerCase() === 'k';
    if (!isK || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    event.preventDefault();
    if (dialog.open) dialog.close();
    else open();
  });

  input.addEventListener('input', () => search(input.value));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(moveActive(shown.length, active, event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      shown[active]?.click();
    }
  });

  // A chosen entry: links go where they point by themselves; the theme entry acts here.
  dialog.addEventListener('click', (event) => {
    const option = (event.target as Element).closest<HTMLElement>('[role="option"]');
    if (!option) return;
    // The theme entry presses the nav's own toggle, so there is one switch and one piece of code behind it.
    if (option.dataset.action === 'toggle-theme') document.querySelector<HTMLElement>('[data-theme-toggle]')?.click();
    dialog.close();
  });

  // Pressing outside closes it. Browsers that understand `closedby` do this themselves.
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    // The pointer's position is tested, not the target: the dialog is also the target for its own padding.
    const outside = (event: PointerEvent) => {
      const box = dialog.getBoundingClientRect();
      return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (event) => (pressedOutside = outside(event)));
    dialog.addEventListener('pointerup', (event) => {
      if (pressedOutside && outside(event)) dialog.close();
    });
  }

  // The key drawn on the nav button matches the visitor's keyboard.
  const apple = /Mac|iPhone|iPad|iPod/.test((navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform);
  if (apple) for (const key of document.querySelectorAll('[data-menu-key]')) key.textContent = '⌘K';
}
