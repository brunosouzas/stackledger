/** Strict XML text writer used by the SVG renderer; npm test parses hostile output.
 * Names are fixed allow-lists; paints must be six-digit hex or none; nonfinite geometry
 * throws rather than producing invalid SVG. Catalogue strings are always XML escaped.
 */
const elements = new Set('svg title desc g path line rect circle ellipse polygon polyline text tspan'.split(' '));

const attributes = new Set([
  'xmlns', 'role', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-opacity',
  'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'data-ref',
  // Read by the site's map script for line highlight and the zone filter; values are escaped like text.
  'data-line', 'data-zone',
]);

const ENTITIES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function allowedInXml(code: number): boolean {
  return code === 9 || code === 10 || code === 13
    || (code >= 32 && code <= 0xD7FF)
    || (code >= 0xE000 && code <= 0xFFFD)
    || code >= 0x10000;
}

export function escapeXml(text: string): string {
  const valid = Array.from(text, char => (allowedInXml(char.codePointAt(0)!) ? char : '�')).join('');
  return valid.replace(/[&<>"']/g, char => ENTITIES[char]!);
}

export function number(value: number): string {
  if (!Number.isFinite(value)) throw new Error('SVG geometry must be finite');
  return String(Math.round(value * 100) / 100);
}

export function color(value: string): string {
  if (value !== 'none' && !HEX_COLOUR.test(value)) throw new Error('SVG colour must be #RRGGBB or none');
  return value;
}

/** Mix a #RRGGBB colour with white; amount 0 returns it unchanged, 1 returns white. */
export function tint(value: string, amount: number): string {
  if (!HEX_COLOUR.test(value)) throw new Error('SVG colour must be #RRGGBB or none');
  if (!(amount >= 0 && amount <= 1)) throw new Error('Tint amount must be between 0 and 1');
  if (amount === 0) return value;
  const channels = [1, 3, 5].map(start => Math.round(parseInt(value.slice(start, start + 2), 16) * (1 - amount) + 255 * amount));
  return '#' + channels.map(channel => channel.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export type Attributes = Record<string, string | number>;

export function tag(name: string, attrs: Attributes = {}, children?: string): string {
  if (!elements.has(name)) throw new Error('Unsupported SVG element');
  const values = Object.entries(attrs).map(([key, value]) => {
    if (!attributes.has(key)) throw new Error('Unsupported SVG attribute');
    if (key === 'xmlns' && value !== SVG_NAMESPACE) throw new Error('Unsupported SVG namespace');
    if (key === 'role' && value !== 'img') throw new Error('Unsupported SVG role');
    let text: string;
    if (typeof value === 'number') text = number(value);
    else if (key === 'fill' || key === 'stroke') text = color(value);
    else text = value;
    return ` ${key}="${escapeXml(text)}"`;
  }).join('');
  return children === undefined ? `<${name}${values}/>` : `<${name}${values}>${children}</${name}>`;
}
