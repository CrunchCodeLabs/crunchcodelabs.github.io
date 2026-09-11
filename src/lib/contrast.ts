export const WHITE = '#FFFFFF';
export const INK = '#141413';

/** WCAG 2.1 minimum for normal-size body text. */
export const AA_BODY = 4.5;
/** WCAG 2.1 minimum for text >= 24px, or >= 18.66px bold. */
export const AA_LARGE = 3;

function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of white or ink reads better on `background`. */
export function onColor(background: string): typeof WHITE | typeof INK {
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK) ? WHITE : INK;
}

export function meets(background: string, foreground: string, threshold = AA_BODY): boolean {
  return contrastRatio(background, foreground) >= threshold;
}
