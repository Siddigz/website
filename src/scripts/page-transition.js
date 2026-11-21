// @ts-check
/*
 * Carries a project's title and picture between its card on the home page and
 * its own page, where the browser can animate from one page to the next.
 *
 * This file is put in the head of every page as it is, not bundled: it has to
 * be listening before the page is first drawn, which a bundled script is not.
 * That is also why it is plain JavaScript.
 *
 * The project page gives its title and lead picture fixed names in CSS. Here,
 * the same names are lent to the one card being left or come back to, for the
 * length of the transition, so no two elements ever share a name.
 */
(() => {
  /** @param {string} url */
  const projectSlug = (url) => /^\/projects\/([^/]+)\/?$/.exec(new URL(url).pathname)?.[1];

  /** @param {Element} element */
  const onScreen = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
  };

  /**
   * Sets a transition name on each element until the transition is over.
   * @param {[HTMLElement | null, string][]} pairs
   * @param {ViewTransition} transition
   */
  const lend = (pairs, transition) => {
    const named = /** @type {[HTMLElement, string][]} */ (pairs.filter(([element]) => element));
    for (const [element, name] of named) element.style.viewTransitionName = name;
    const clear = () => named.forEach(([element]) => element.style.removeProperty('view-transition-name'));
    transition.finished.then(clear, clear);
  };

  /**
   * On the home page: the card of the project being left or come back to.
   * A card that is off screen takes no part, so nothing flies in from outside.
   * @param {string | undefined} slug
   * @param {ViewTransition} transition
   */
  const connectCard = (slug, transition) => {
    const card = slug && document.querySelector(`[data-seen-slug="${CSS.escape(slug)}"]`);
    if (!card) return;
    /** @type {HTMLElement | null} */
    const heading = card.querySelector('h3');
    /** @type {HTMLElement | null} */
    const picture = card.querySelector('img');
    lend(
      [
        [heading && onScreen(heading) ? heading : null, 'project-title'],
        [picture && onScreen(picture) ? picture : null, 'project-image'],
      ],
      transition,
    );
  };

  // Leaving this page for a project's page.
  addEventListener('pageswap', (event) => {
    if (event.viewTransition && event.activation?.entry.url) connectCard(projectSlug(event.activation.entry.url), event.viewTransition);
  });

  // Arriving on this page.
  addEventListener('pagereveal', (event) => {
    if (!event.viewTransition) return;
    const activation = window.navigation?.activation;
    // An address that names a part of the page ("/#projects"): the browser is
    // about to go there by itself. Going now, before the page is first drawn,
    // lets the animation end where the page will actually be. Going back or
    // forward is left alone: the browser puts the page where it was.
    if (location.hash.length > 1 && activation?.navigationType !== 'traverse') {
      try {
        document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'instant' });
      } catch {
        // An address that cannot be decoded names nothing.
      }
    }
    const from = activation?.from?.url;
    if (from) connectCard(projectSlug(from), event.viewTransition);
    // On a project page: a lead picture that starts off screen stays out of it.
    /** @type {HTMLElement | null} */
    const lead = document.querySelector('[data-transition-image]');
    if (lead && !onScreen(lead)) lend([[lead, 'none']], event.viewTransition);
  });
})();
