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
      /* localStorage unavailable; fall back to default */
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
    toggle.setAttribute('aria-checked', isDark ? 'true' : 'false');
    toggle.setAttribute(
      'aria-label',
      isDark ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  function clearThemeTransitionGuard(className) {
    var root = document.documentElement;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.remove(className);
      });
    });
  }

  function applyThemeSwitch(next) {
    var root = document.documentElement;
    root.classList.add('theme-switching');
    persistTheme(next);
    applyTheme(next);
    clearThemeTransitionGuard('theme-switching');
  }

  function playLiquidThemeSwitch(toggle, next) {
    var root = document.documentElement;
    var overlay = document.getElementById('theme-liquid-overlay');
    if (!overlay || !toggle) {
      applyThemeSwitch(next);
      return;
    }

    var blobs = overlay.querySelectorAll('.theme-liquid-blob');
    var rect = toggle.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var liquidDuration = 950;
    var switchAt = 320;

    overlay.classList.remove('to-light', 'to-dark');
    overlay.classList.add(next === 'dark' ? 'to-dark' : 'to-light');

    blobs.forEach(function (blob) {
      blob.style.left = x + 'px';
      blob.style.top = y + 'px';
      blob.style.animation = 'none';
      void blob.offsetWidth;
      blob.style.animation = '';
    });

    toggle.classList.add('is-liquidating');
    overlay.classList.add('is-active');

    setTimeout(function () {
      applyThemeSwitch(next);
    }, switchAt);

    setTimeout(function () {
      overlay.classList.remove('is-active', 'to-light', 'to-dark');
      toggle.classList.remove('is-liquidating');
    }, liquidDuration);
  }

  function toggleTheme() {
    var toggle = document.getElementById('theme-toggle');
    var root = document.documentElement;
    var current = root.getAttribute('data-theme') || DEFAULT_THEME;
    var next = current === 'dark' ? 'light' : 'dark';

    if (prefersReducedMotion()) {
      applyThemeSwitch(next);
      return;
    }

    playLiquidThemeSwitch(toggle, next);
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

  function getContactEmail() {
    var user = 'siddig' + 'z';
    var host = String.fromCharCode(104, 111, 116, 109, 97, 105, 108);
    return user + '@' + host + '.com';
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        resolve();
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  function initEmailReveal() {
    var buttons = document.querySelectorAll('.js-email-reveal');
    if (!buttons.length) return;

    var email = null;

    function assembleEmail() {
      if (!email) {
        email = getContactEmail();
      }
      return email;
    }

    function replaceFooterWithEmailLink(btn, address) {
      var revealed = document.createElement('div');
      revealed.className = 'contact-email-revealed';

      var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon');
      icon.setAttribute('aria-hidden', 'true');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#icon-email');
      icon.appendChild(use);

      var link = document.createElement('a');
      link.href = 'mailto:' + address;
      link.className = 'contact-email';
      link.textContent = address;
      link.setAttribute('aria-label', 'Send email to ' + address);
      link.addEventListener('click', function (e) {
        var selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          e.preventDefault();
        }
      });

      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'contact-email-copy';
      copyBtn.setAttribute('aria-label', 'Copy email address');

      var copyIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      copyIcon.setAttribute('class', 'icon');
      copyIcon.setAttribute('aria-hidden', 'true');
      var copyUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      copyUse.setAttribute('href', '#icon-copy');
      copyIcon.appendChild(copyUse);
      copyBtn.appendChild(copyIcon);

      var copyResetTimer = null;
      copyBtn.addEventListener('click', function () {
        copyToClipboard(address).then(function () {
          if (copyResetTimer) {
            clearTimeout(copyResetTimer);
          }

          copyBtn.classList.add('is-copied');
          copyBtn.setAttribute('aria-label', 'Copied');
          copyUse.setAttribute('href', '#icon-check');

          copyResetTimer = setTimeout(function () {
            copyBtn.classList.remove('is-copied');
            copyBtn.setAttribute('aria-label', 'Copy email address');
            copyUse.setAttribute('href', '#icon-copy');
            copyResetTimer = null;
          }, 2000);
        });
      });

      revealed.appendChild(icon);
      revealed.appendChild(link);
      revealed.appendChild(copyBtn);
      btn.replaceWith(revealed);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var address = assembleEmail();

        if (btn.getAttribute('data-revealed') === 'true') {
          var selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return;
          }
          window.location.href = 'mailto:' + address;
          return;
        }

        if (btn.getAttribute('data-email-context') === 'footer') {
          replaceFooterWithEmailLink(btn, address);
          return;
        }

        btn.setAttribute('data-revealed', 'true');
        btn.classList.add('is-revealed');
        btn.setAttribute('aria-label', 'Send email to ' + address);

        var iconUse = btn.querySelector('.js-email-reveal-icon use');
        if (iconUse) {
          iconUse.setAttribute('href', '#icon-email');
        }
      });
    });
  }

  function initScrollPerformance() {
    if (prefersReducedMotion()) return;

    var root = document.documentElement;
    var scrollTimer = null;
    var ticking = false;

    function setScrolling(active) {
      if (active) {
        root.classList.add('is-scrolling');
      } else {
        root.classList.remove('is-scrolling');
      }
    }

    function onScrollFrame() {
      ticking = false;
      setScrolling(true);

      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }

      scrollTimer = setTimeout(function () {
        setScrolling(false);
        scrollTimer = null;
      }, 120);
    }

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(onScrollFrame);
        }
      },
      { passive: true }
    );
  }

  function getRevealStaggerDelay(el) {
    var parent = el.parentElement;
    if (!parent) return '0ms';

    var siblings = [];
    for (var i = 0; i < parent.children.length; i++) {
      var child = parent.children[i];
      if (child.classList.contains('reveal')) {
        siblings.push(child);
      }
    }

    var index = siblings.indexOf(el);
    if (index < 0) index = 0;

    return Math.min(index, 4) * 55 + 'ms';
  }

  function revealElement(el) {
    if (el.classList.contains('is-visible')) return;

    el.classList.add('is-animating');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('is-visible');
      });
    });

    el.addEventListener(
      'transitionend',
      function (event) {
        if (event.propertyName !== 'opacity' || event.target !== el) return;
        el.classList.remove('is-animating');
        el.style.removeProperty('--reveal-delay');
      },
      { once: true }
    );
  }

  function initScrollReveal() {
    if (prefersReducedMotion()) return;

    var revealSelectors = [
      '.hero-content > *',
      '.hero-aside > *',
      '.section-header',
      '.experience-entry',
      '.project-card',
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

    elements.forEach(function (el) {
      el.classList.add('reveal');

      if (heroSet.has(el)) {
        setTimeout(function () {
          revealElement(el);
        }, heroDelay);
        heroDelay += 70;
        return;
      }

      el.style.setProperty('--reveal-delay', getRevealStaggerDelay(el));

      if (typeof IntersectionObserver === 'undefined') {
        revealElement(el);
      }
    });

    if (typeof IntersectionObserver === 'undefined') return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealElement(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px 8% 0px' }
    );

    elements.forEach(function (el) {
      if (!heroSet.has(el)) {
        observer.observe(el);
      }
    });
  }

  function init() {
    applyTheme(getStoredTheme());
    clearThemeTransitionGuard('theme-loading');
    initThemeToggle();
    initEmailReveal();
    initScrollPerformance();
    initScrollReveal();
  }

  /* Sync theme state; inline head script applies before first paint */
  applyTheme(getStoredTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
