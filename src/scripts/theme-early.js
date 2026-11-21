// Applies a stored theme choice before the page is first drawn, so it never
// flashes the other theme. Put in the head as it is; nothing else belongs here.
try {
  var stored = localStorage.getItem('color-scheme');
  if (stored === 'light' || stored === 'dark') {
    document.querySelector('meta[name="color-scheme"]').content = stored;
    // The browser-bar colour follows the pinned theme, not the system.
    document.querySelectorAll('meta[data-bar]').forEach(function (bar) {
      bar.media = bar.dataset.bar === stored ? 'all' : 'not all';
    });
  }
} catch (error) {}
