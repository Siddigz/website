/*
 * The signal explainer: reads the controls, updates the four readouts and
 * draws the three pictures. Every colour is read from the design tokens, so
 * the drawings follow the theme; they are drawn again when the theme or the
 * width changes. The maths lives in src/lib/explainers/signal.ts.
 */
import {
  SEED_OFFSET,
  START,
  Y_MAX,
  Y_MIN,
  gauss,
  labelsOf,
  levelsOf,
  mulberry32,
  readouts,
  simulate,
  waveNote,
  waveform,
  type Levels,
} from '../../lib/explainers/signal';

const root = document.querySelector<HTMLElement>('[data-signal]');

if (root) {
  const state = { ...START };
  const find = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const canvasOf = (name: string) => find<HTMLCanvasElement>(`canvas[data-drawing="${name}"]`);

  /** A token's colour as the browser resolves it right now, in the current theme. */
  const colourOf = (token: string): string => {
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    root.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  };
  let colours = { right: '', wrong: '', muted: '', text: '' };
  const readColours = () => {
    colours = {
      right: colourOf('--color-accent'),
      wrong: colourOf('--color-wrong'),
      muted: colourOf('--color-text-muted'),
      text: colourOf('--color-text'),
    };
  };

  type Frame = { ctx: CanvasRenderingContext2D; left: number; top: number; width: number; height: number };
  const LABEL_ROOM = 74;
  const EDGE = 8;

  /** Sizes a canvas to its box at the screen's own sharpness and clears it. */
  function prepare(canvas: HTMLCanvasElement): Frame | null {
    const box = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx || box.width === 0) return null;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * scale);
    canvas.height = Math.round(box.height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    return { ctx, left: LABEL_ROOM, top: EDGE, width: box.width - LABEL_ROOM - 14, height: box.height - 2 * EDGE };
  }

  const yOf = (frame: Frame, value: number) => frame.top + ((Y_MAX - value) / (Y_MAX - Y_MIN)) * frame.height;

  function line(frame: Frame, y: number, dash: number[], colour: string, width: number): void {
    const { ctx } = frame;
    ctx.save();
    ctx.setLineDash(dash);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(frame.left, y);
    ctx.lineTo(frame.left + frame.width, y);
    ctx.stroke();
    ctx.restore();
  }

  /** A dashed line and a bit label for each level. */
  function drawLevels(frame: Frame): void {
    const { ctx } = frame;
    const labels = labelsOf(state.levels, state.gray);
    ctx.save();
    ctx.font = `12px ${getComputedStyle(root!).fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    levelsOf(state.levels).forEach((level, index) => {
      const y = yOf(frame, level);
      line(frame, y, [4, 4], colours.muted, 1);
      ctx.fillStyle = colours.text;
      ctx.fillText(labels[index] ?? '', frame.left - 8, y);
    });
    ctx.restore();
  }

  /** A dotted line halfway between each pair of levels: where the receiver's decision flips. */
  function drawThresholds(frame: Frame): void {
    for (let index = 0; index < state.levels - 1; index += 1) {
      line(frame, yOf(frame, (index + 0.5) / (state.levels - 1)), [2, 3], colours.wrong, 1.3);
    }
  }

  function drawWave(): number {
    const { cells, wrong } = waveform(state.levels, state.sigma, state.seed);
    const canvas = canvasOf('wave');
    const frame = canvas && prepare(canvas);
    if (!frame) return wrong;
    const { ctx } = frame;
    const levels = levelsOf(state.levels);
    const cell = frame.width / cells.length;
    const start = (index: number) => frame.left + index * cell + 2;
    const end = (index: number) => frame.left + (index + 1) * cell - 2;
    const middle = (index: number) => frame.left + (index + 0.5) * cell;
    drawLevels(frame);
    drawThresholds(frame);

    // What was sent: a thin staircase.
    ctx.strokeStyle = colours.muted;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    cells.forEach(({ sent }, index) => {
      const y = yOf(frame, levels[sent]!);
      ctx.moveTo(start(index), y);
      ctx.lineTo(end(index), y);
      const before = cells[index - 1];
      if (before && before.sent !== sent) {
        ctx.moveTo(start(index), yOf(frame, levels[before.sent]!));
        ctx.lineTo(start(index), y);
      }
    });
    ctx.stroke();

    // What was measured: a line through the samples.
    ctx.strokeStyle = colours.right;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    cells.forEach(({ received }, index) => {
      if (index === 0) ctx.moveTo(middle(index), yOf(frame, received));
      else ctx.lineTo(middle(index), yOf(frame, received));
    });
    ctx.stroke();

    // A dot per sample. A misread one is another colour and carries a cross, so colour is not the only sign.
    cells.forEach(({ received, bad }, index) => {
      const x = middle(index);
      const y = yOf(frame, received);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = bad ? colours.wrong : colours.right;
      ctx.fill();
      if (!bad) return;
      ctx.strokeStyle = colours.wrong;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 3.5, y - 13.5);
      ctx.lineTo(x + 3.5, y - 6.5);
      ctx.moveTo(x + 3.5, y - 13.5);
      ctx.lineTo(x - 3.5, y - 6.5);
      ctx.stroke();
    });
    return wrong;
  }

  function drawEye(): void {
    const canvas = canvasOf('eye');
    const frame = canvas && prepare(canvas);
    if (!frame) return;
    const { ctx } = frame;
    const levels = levelsOf(state.levels);
    const rng = mulberry32(state.seed + SEED_OFFSET.eye);
    const TRACES = 300;
    const POINTS = 64;
    const sent: number[] = [];
    const noise: number[] = [];
    for (let index = 0; index < TRACES + 2; index += 1) {
      sent.push(levels[Math.floor(rng() * state.levels)]!);
      noise.push(state.sigma * gauss(rng));
    }
    // A smooth ramp from one symbol to the next, centred on the boundary between them.
    const ramp = (x: number) => (x <= -0.5 ? 0 : x >= 0.5 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * (x + 0.5)));
    const trace = (index: number, time: number) =>
      time < 0.5
        ? sent[index - 1]! + (sent[index]! - sent[index - 1]!) * ramp(time)
        : sent[index]! + (sent[index + 1]! - sent[index]!) * ramp(time - 1);
    const xOf = (time: number) => frame.left + ((time + 0.5) / 2) * frame.width;
    drawLevels(frame);

    // The sampling instant, at the centre.
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = colours.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xOf(0.5), frame.top);
    ctx.lineTo(xOf(0.5), frame.top + frame.height);
    ctx.stroke();
    ctx.restore();

    // Every trace, faint, so the places many of them cross look dense.
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = colours.right;
    ctx.lineWidth = 1;
    for (let index = 1; index <= TRACES; index += 1) {
      ctx.beginPath();
      for (let point = 0; point <= POINTS; point += 1) {
        const time = -0.5 + (2 * point) / POINTS;
        const y = yOf(frame, trace(index, time) + noise[index]! + state.sigma * 0.2 * gauss(rng));
        if (point === 0) ctx.moveTo(xOf(time), y);
        else ctx.lineTo(xOf(time), y);
      }
      ctx.stroke();
    }
    ctx.restore();
    drawThresholds(frame);
  }

  function drawHistogram(result: ReturnType<typeof simulate>): void {
    const canvas = canvasOf('histogram');
    const frame = canvas && prepare(canvas);
    if (!frame) return;
    const { ctx } = frame;
    const step = (Y_MAX - Y_MIN) / result.bins;
    const most = Math.max(1, ...result.ok.map((count, bin) => count + result.bad[bin]!));
    for (let bin = 0; bin < result.bins; bin += 1) {
      const right = result.ok[bin]!;
      const wrong = result.bad[bin]!;
      if (right + wrong === 0) continue;
      const top = yOf(frame, Y_MIN + (bin + 1) * step);
      const height = Math.max(1, yOf(frame, Y_MIN + bin * step) - top - 0.6);
      const rightWidth = (right / most) * frame.width;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = colours.right;
      ctx.fillRect(frame.left, top, rightWidth, height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colours.wrong;
      ctx.fillRect(frame.left + rightWidth, top, (wrong / most) * frame.width, height);
    }
    ctx.strokeStyle = colours.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(frame.left + 0.5, frame.top);
    ctx.lineTo(frame.left + 0.5, frame.top + frame.height);
    ctx.stroke();
    drawLevels(frame);
    drawThresholds(frame);
  }

  function showReadouts(errors: number, wrong: number): void {
    const text = readouts(state.levels, state.sigma, errors);
    for (const name of ['gap', 'bits', 'measured', 'theory'] as const) {
      const card = find(`[data-readout="${name}"]`);
      const [big, small] = text[name];
      const bigLine = card?.querySelector('.big');
      const smallLine = card?.querySelector('.s');
      if (bigLine) bigLine.textContent = big ?? '';
      if (smallLine) smallLine.textContent = small ?? '';
    }
    const caption = find('[data-caption]');
    const note = find('[data-wave-note]');
    const sigma = find('[data-sigma]');
    if (caption && caption.textContent !== text.caption) caption.textContent = text.caption;
    if (note) note.textContent = waveNote(wrong);
    if (sigma) sigma.textContent = state.sigma.toFixed(3);
    for (const button of root!.querySelectorAll<HTMLElement>('[data-levels]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.levels) === state.levels));
    }
  }

  function render(): void {
    const result = simulate(state.levels, state.sigma, state.seed + SEED_OFFSET.histogram);
    const wrong = drawWave();
    drawEye();
    drawHistogram(result);
    showReadouts(result.errors, wrong);
  }

  /** Draws on the next frame, however many things asked for it since the last one. */
  let waiting = 0;
  const redraw = () => {
    cancelAnimationFrame(waiting);
    waiting = requestAnimationFrame(() => {
      readColours();
      render();
    });
  };

  for (const button of root.querySelectorAll<HTMLElement>('[data-levels]')) {
    button.addEventListener('click', () => {
      state.levels = Number(button.dataset.levels) as Levels;
      render();
    });
  }
  find<HTMLInputElement>('[data-slider]')?.addEventListener('input', (event) => {
    state.sigma = Number((event.target as HTMLInputElement).value) || 0;
    render();
  });
  find<HTMLInputElement>('[data-gray]')?.addEventListener('change', (event) => {
    state.gray = (event.target as HTMLInputElement).checked;
    render();
  });
  find('[data-resample]')?.addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 2147483646) + 1;
    render();
  });

  // The theme can change by the toggle, by another tab or with the system; the width with the window.
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) new MutationObserver(redraw).observe(scheme, { attributes: true, attributeFilter: ['content'] });
  // Older browsers lack one or the other of these; the drawings still appear, they just do not follow later changes.
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);
  if (typeof ResizeObserver === 'function') new ResizeObserver(redraw).observe(root);

  // A reloaded page may come back with the controls where the visitor left them.
  const slider = find<HTMLInputElement>('[data-slider]');
  const gray = find<HTMLInputElement>('[data-gray]');
  if (slider) state.sigma = Number(slider.value) || 0;
  if (gray) state.gray = gray.checked;

  readColours();
  render();
}
