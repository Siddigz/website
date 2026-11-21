/*
 * The skills strip slows to a stop when the mouse is over it or its Pause box
 * is ticked, and picks up speed again afterwards, instead of freezing and
 * jumping. Without this script the strip still pauses, at once (see the
 * component's styles). With reduced motion there is no movement to ease.
 */
const strip = document.querySelector<HTMLElement>('#skills .strip');
const viewport = strip?.querySelector<HTMLElement>('[data-skills-viewport]');
const track = strip?.querySelector<HTMLElement>('[data-track]');
const pause = strip?.querySelector<HTMLInputElement>('.pause input');

if (strip && viewport && track) {
  // From here on the styles leave pausing to this script.
  strip.dataset.eased = '';
  let hovered = false;
  let frame = 0;

  /** How long the change of speed takes, from the design tokens. */
  const duration = () => {
    // The built stylesheet may write the same time as "300ms" or ".3s".
    const value = getComputedStyle(strip).getPropertyValue('--duration-glide').trim();
    return (parseFloat(value) || 0) * (value.endsWith('ms') ? 1 : 1000);
  };

  function glide(): void {
    // Looked up each time: the strip only moves while the visitor allows motion.
    const moving = track!.getAnimations()[0];
    if (!moving) return;
    const target = hovered || pause?.checked ? 0 : 1;
    const from = moving.playState === 'paused' ? 0 : moving.playbackRate;
    const length = duration() * Math.abs(target - from);
    const start = performance.now();
    cancelAnimationFrame(frame);
    if (target > 0 && moving.playState === 'paused') {
      moving.playbackRate = from;
      moving.play();
    }
    const step = (now: number) => {
      // A frame's time can be a touch earlier than the moment the glide began.
      const progress = length > 0 ? Math.min(1, Math.max(0, (now - start) / length)) : 1;
      // The speed changes steadily, so the strip glides to rest like something with weight.
      moving.playbackRate = from + (target - from) * progress;
      if (progress < 1) frame = requestAnimationFrame(step);
      else if (target === 0) moving.pause();
    };
    frame = requestAnimationFrame(step);
  }

  // Only a mouse hovers. On a touch screen a tap would otherwise stop the strip until the next tap elsewhere.
  viewport.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = true;
    glide();
  });
  viewport.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = false;
    glide();
  });
  pause?.addEventListener('change', glide);
  // A reloaded page can come back with the box still ticked.
  if (pause?.checked) glide();
}
