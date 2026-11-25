/*
 * The small still drawing of each explainer, as plain shapes. One description
 * serves two places: the explainer's card on the home page (coloured by the
 * design tokens, so it follows the theme) and its link preview picture
 * (coloured outright). Each shape names the part it plays, not a colour.
 */
import { thumbnail } from './signal';

export type Shape = {
  tag: 'rect' | 'line' | 'path' | 'circle' | 'polygon';
  /** The part this shape plays, such as "fiber" or "dot-bad". Styles and colours are chosen by it. */
  role: string;
  attrs: Record<string, string | number>;
};

export const DRAWING_SIZE = { width: 320, height: 180 };

/** Follow a packet: the row of stops with the packet at the second one, over the packet as four nested layers. */
export function packetDrawing(): Shape[] {
  // The row of stops: the first is behind the packet, the second is where it is, and a stretch in the middle is fiber.
  const trail = { y: 28, first: 34, gap: 42, count: 7, now: 1, fiber: { from: 2, to: 4 }, r: 6, rNow: 9 };
  const stopX = (index: number) => trail.first + index * trail.gap;
  const stops = Array.from({ length: trail.count }, (_, index): Shape => {
    const role = index === trail.now ? 'stop-now' : index < trail.now ? 'stop-done' : 'stop';
    return { tag: 'circle', role, attrs: { cx: stopX(index), cy: trail.y, r: index === trail.now ? trail.rNow : trail.r } };
  });

  // The packet: each layer is a box inside the one before it. In each, a short bar stands for the layer's name and
  // longer ones for its values; the values a router has just rewritten are drawn as chips.
  const outer = { x: 52, y: 52, width: 216, height: 116 };
  const step = { x: 14, y: 22, bottom: 8 };
  const bar = { inset: 11, top: 8, height: 6, gap: 6, chipGrow: 2 };
  type Value = { changed?: true; width: number };
  const layers: { name: string; label: number; values: Value[]; rx: number }[] = [
    { name: 'eth', label: 30, values: [{ changed: true, width: 18 }, { changed: true, width: 18 }], rx: 9 },
    { name: 'ip', label: 16, values: [{ width: 40 }, { changed: true, width: 26 }, { changed: true, width: 14 }], rx: 8 },
    { name: 'tcp', label: 24, values: [{ width: 22 }], rx: 7 },
    { name: 'data', label: 28, values: [{ width: 60 }], rx: 6 },
  ];
  const packet = layers.flatMap(({ name, label, values, rx }, depth): Shape[] => {
    const box = {
      x: outer.x + depth * step.x,
      y: outer.y + depth * step.y,
      width: outer.width - depth * step.x * 2,
      height: outer.height - depth * (step.y + step.bottom),
    };
    // The innermost layer has nothing below its line, so the line sits in its middle.
    const last = depth === layers.length - 1;
    const top = last ? box.y + (box.height - bar.height) / 2 : box.y + bar.top;
    let x = box.x + bar.inset;
    const line: Shape[] = [{ tag: 'rect', role: `label-${name}`, attrs: { x, y: top, width: label, height: bar.height, rx: bar.height / 2 } }];
    x += label + bar.gap;
    for (const value of values) {
      line.push(
        value.changed
          ? { tag: 'rect', role: 'changed', attrs: { x, y: top - bar.chipGrow, width: value.width, height: bar.height + bar.chipGrow * 2, rx: 3 } }
          : { tag: 'rect', role: 'value', attrs: { x, y: top, width: value.width, height: bar.height, rx: bar.height / 2 } },
      );
      x += value.width + bar.gap;
    }
    return [{ tag: 'rect', role: `layer-${name}`, attrs: { ...box, rx } }, ...line];
  });

  return [
    { tag: 'line', role: 'trail', attrs: { x1: stopX(0), x2: stopX(trail.count - 1), y1: trail.y, y2: trail.y } },
    { tag: 'line', role: 'fiber', attrs: { x1: stopX(trail.fiber.from), x2: stopX(trail.fiber.to), y1: trail.y, y2: trail.y } },
    ...stops,
    ...packet,
  ];
}

/** NRZ vs PAM4: four levels, the signal as sent and as measured, and the symbols read wrongly. */
export function signalDrawing(): Shape[] {
  const drawing = thumbnail(DRAWING_SIZE);
  const across = { x1: drawing.left, x2: drawing.right };
  return [
    ...drawing.levels.map((y): Shape => ({ tag: 'line', role: 'level', attrs: { ...across, y1: y, y2: y } })),
    ...drawing.thresholds.map((y): Shape => ({ tag: 'line', role: 'threshold', attrs: { ...across, y1: y, y2: y } })),
    { tag: 'path', role: 'sent', attrs: { d: drawing.sent } },
    { tag: 'path', role: 'received', attrs: { d: drawing.received } },
    ...drawing.points.flatMap((point): Shape[] => [
      { tag: 'circle', role: point.bad ? 'dot-bad' : 'dot', attrs: { cx: point.x, cy: point.y, r: 4 } },
      // A misread symbol also carries a cross, so colour is not the only sign.
      ...(point.bad ? [{ tag: 'path', role: 'cross', attrs: { d: `M${point.x - 4} ${point.y - 15}l8 8m0 -8l-8 8` } } satisfies Shape] : []),
    ]),
  ];
}

/** Each explainer's drawing, by the name of its content file. */
export const DRAWINGS: Record<string, () => Shape[]> = {
  'follow-a-packet': packetDrawing,
  'nrz-vs-pam4': signalDrawing,
};

export type Paint = { fill?: string; stroke?: string; width?: number; dash?: string; opacity?: number };

/** The drawing as a picture that stands on its own, with every part painted as `paint` says. */
export function drawingSvg(shapes: Shape[], paint: Record<string, Paint>): string {
  const body = shapes
    .map(({ tag, role, attrs }) => {
      const style = paint[role];
      if (!style) throw new Error(`The drawing has a part with no colour: ${role}`);
      const all: Record<string, string | number> = {
        ...attrs,
        fill: style.fill ?? 'none',
        ...(style.stroke ? { stroke: style.stroke, 'stroke-width': style.width ?? 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } : {}),
        ...(style.dash ? { 'stroke-dasharray': style.dash } : {}),
        ...(style.opacity === undefined ? {} : { opacity: style.opacity }),
      };
      return `<${tag} ${Object.entries(all).map(([name, value]) => `${name}="${value}"`).join(' ')}/>`;
    })
    .join('');
  const { width, height } = DRAWING_SIZE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}
