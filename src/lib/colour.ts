/*
 * Colour arithmetic for values written as `oklch(L% C H)`, the form the
 * design tokens use. Used at build time for the browser-bar colour, and by
 * the tests that check text contrast.
 */

/** Red, green and blue as linear light, each 0 to 1. */
function linearRgb(colour: string): [number, number, number] {
  const match = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(colour.trim());
  if (!match) throw new Error(`expected oklch(L% C H), got ${colour}`);
  const lightness = Number(match[1]) / 100;
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** The colour as `#rrggbb`, for places that cannot take oklch(). */
export function toHex(colour: string): string {
  const encode = (value: number) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
  return `#${linearRgb(colour)
    .map((value) => Math.round(encode(value) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Relative luminance, as WCAG defines it. */
export function luminance(colour: string): number {
  const [red, green, blue] = linearRgb(colour);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** The value a stylesheet gives a custom property the first time it declares it. */
export function declaredValue(css: string, name: string): string {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  if (!match) throw new Error(`${name} is not declared`);
  return match[1]!.trim();
}
