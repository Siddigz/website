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

/** One packet, hop by hop: the packet in its four layers, part-way along a row of devices. */
export function packetDrawing(): Shape[] {
  const stops = [36, 98, 160, 222, 284];
  const at = 1; // the packet sits over the second stop
  const from = stops[at]!;
  const to = stops[at + 1]!;
  return [
    { tag: 'rect', role: 'region-near', attrs: { x: 6, y: 50, width: 124, height: 112, rx: 10 } },
    { tag: 'rect', role: 'region-far', attrs: { x: 190, y: 50, width: 124, height: 112, rx: 10 } },
    { tag: 'line', role: 'wire', attrs: { x1: stops[0]!, x2: stops[1]!, y1: 112, y2: 112 } },
    { tag: 'line', role: 'fiber', attrs: { x1: stops[1]!, x2: stops[3]!, y1: 112, y2: 112 } },
    { tag: 'line', role: 'wire', attrs: { x1: stops[3]!, x2: stops[4]!, y1: 112, y2: 112 } },
    ...stops.map(
      (x, index): Shape =>
        index === 2
          ? { tag: 'polygon', role: 'amplifier', attrs: { points: `${x - 13},98 ${x - 13},126 ${x + 13},112` } }
          : { tag: 'rect', role: 'node', attrs: { x: x - 20, y: 94, width: 40, height: 36, rx: 6 } },
    ),
    // The path the packet has still to travel.
    { tag: 'path', role: 'hop', attrs: { d: `M${from} 70 Q ${(from + to) / 2} 34 ${to} 70` } },
    ...['layer-eth', 'layer-ip', 'layer-tcp', 'layer-data'].map((role, index): Shape => ({ tag: 'rect', role, attrs: { x: from - 28 + index * 14, y: 60, width: 14, height: 18 } })),
    { tag: 'rect', role: 'outline', attrs: { x: from - 28, y: 60, width: 56, height: 18, rx: 2 } },
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
  'one-packet-hop-by-hop': packetDrawing,
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
