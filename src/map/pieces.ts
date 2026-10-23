/** Writes the output of a @brunosouzas/design-system piece through this map's own SVG writer
 * (metro-map: Design system pieces). Every node goes through tag() of src/map/xml.ts, so the element
 * and attribute allow-lists, the paint check, finite numbers and the escaping apply to it as to every
 * other node: a piece node outside those rules throws instead of reaching a page.
 *
 * The pieces name `Lato, 'Helvetica Neue', …` on every text. The writer leaves that `font-family` out:
 * the root svg names the same families without quotes, so nothing renders differently and no quote
 * character reaches an attribute value. Call writePiece(stationMarker({ … })). Pure, no I/O.
 */
import type { Drawn, SvgNode } from '@brunosouzas/design-system';
import { escapeXml, tag, type Attributes } from './xml.js';

function writeNode(node: SvgNode | string): string {
  if (typeof node === 'string') return escapeXml(node);
  const attrs: Attributes = {};
  for (const [name, value] of Object.entries(node.attrs)) if (name !== 'font-family') attrs[name] = value;
  return tag(node.tag, attrs, node.children.length ? node.children.map(writeNode).join('') : undefined);
}

/** The piece's shapes, then its words, as SVG text. */
export function writePiece(drawn: Drawn): string {
  return [...drawn.body, ...drawn.text].map(writeNode).join('');
}
