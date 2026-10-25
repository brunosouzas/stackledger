/** SVG checks shared by the map and diagram tests: parse with an independently pinned XML parser
 * and enforce the element and attribute allow-lists, copied from the metro-map spec. Run npm test.
 */
import { expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
export const elements=new Set('svg title desc g path line rect circle ellipse polygon polyline text tspan'.split(' '));
export const attributes=new Set('xmlns role viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray opacity fill-opacity stroke-opacity font-family font-size font-weight text-anchor dominant-baseline data-ref data-line data-zone'.split(' '));
// U+FFFD is required output for invalid XML characters; the parser warns on this valid character.
export function parseSvg(svg:string){return new DOMParser({onError:(level,message)=>{if(level!=='warning' || message!=='Unicode replacement character detected, source encoding issues?')throw new Error(`${level}: ${message}`);}}).parseFromString(svg,'image/svg+xml');}
/** Problems that make an SVG not inert: active or styling elements, event, style or link attributes, and any
 * reference other than an internal url(#id) (any case, escapes refused). Checks the root too. Used by the
 * site art and how-it-works tests. */
export function activeParts(svg: string): string[] {
  const found: string[] = [];
  for (const element of Array.from(parseSvg(svg).getElementsByTagName('*'))) {
    if (['script', 'foreignobject', 'style'].includes(element.tagName.toLowerCase())) found.push(element.tagName);
    for (const attr of Array.from(element.attributes)) {
      if (/^on|^style$|href$/i.test(attr.name)) found.push(attr.name);
      // No backslash anywhere: CSS escapes could spell url( in a way the pattern below does not see.
      if (attr.value.includes('\\')) found.push(`${attr.name}: escape`);
      for (const ref of attr.value.matchAll(/url\s*\(([^)]*)\)/gi)) if (!/^#[\w-]+$/.test(ref[1]!.trim())) found.push(`${attr.name}: ${ref[0]}`);
    }
  }
  return found;
}
export function safe(svg:string){
 const doc=parseSvg(svg);expect(doc.documentElement.tagName).toBe('svg');expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');expect(doc.documentElement.getAttribute('role')).toBe('img');
 expect(svg).not.toMatch(/<!DOCTYPE|<!ENTITY|<\?/i);
 for(const element of Array.from(doc.getElementsByTagName('*'))){expect(elements.has(element.tagName),element.tagName).toBe(true);for(const attr of Array.from(element.attributes)){expect(attributes.has(attr.name),attr.name).toBe(true);if(['fill','stroke'].includes(attr.name))expect(attr.value).toMatch(/^(?:#[0-9A-Fa-f]{6}|none)$/);expect(attr.value).not.toMatch(/url\(/i);}}
 return doc;
}
