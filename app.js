(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var DEFAULT_THEME = 'light';
  var VALID_THEMES = { dark: true, light: true };
  var THEME_COLORS = { light: '#f8f9fa', dark: '#0b0b0c' };

  function getStoredTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_THEMES[stored]) {
        return stored;
      }
    } catch (err) {
      /* localStorage unavailable — fall back to default */
    }
    return DEFAULT_THEME;
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      /* ignore write failures */
    }
  }

  function updateThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLORS[theme] || THEME_COLORS.light;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    syncToggleButton(theme);
    updateThemeColor(theme);
  }

  function syncToggleButton(theme) {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    var isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    toggle.setAttribute(
      'aria-label',
      isDark ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    var next = current === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    applyTheme(next);
  }

  function initThemeToggle() {
    syncToggleButton(getStoredTheme());

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', toggleTheme);
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initScrollReveal() {
    if (prefersReducedMotion()) return;

    var revealSelectors = [
      '.hero-content > *',
      '.hero-aside > *',
      '.section-header',
      '.experience-entry',
      '.project-card-link',
      '.skill-category',
      '.contact-footer',
      '.footer-copyright'
    ];

    var elements = document.querySelectorAll(revealSelectors.join(','));
    if (!elements.length) return;

    document.documentElement.classList.add('reveal-enabled');

    var heroSelectors = '.hero-content > *, .hero-aside > *';
    var heroElements = document.querySelectorAll(heroSelectors);
    var heroSet = new Set(Array.prototype.slice.call(heroElements));

    var heroDelay = 0;

    elements.forEach(function (el, index) {
      el.classList.add('reveal');

      if (heroSet.has(el)) {
        setTimeout(function () {
          el.classList.add('is-visible');
        }, heroDelay);
        heroDelay += 100;
        return;
      }

      el.style.setProperty('--reveal-delay', (index % 4) * 80 + 'ms');

      if (typeof IntersectionObserver === 'undefined') {
        el.classList.add('is-visible');
        return;
      }
    });

    if (typeof IntersectionObserver === 'undefined') return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -5% 0px' }
    );

    elements.forEach(function (el) {
      if (!heroSet.has(el)) {
        observer.observe(el);
      }
    });
  }

  function init() {
    initThemeToggle();
    initScrollReveal();
  }

  /* Anti-flash: apply saved theme before CSS paints */
  applyTheme(getStoredTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
