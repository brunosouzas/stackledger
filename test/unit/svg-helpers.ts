/** SVG checks shared by the map and diagram tests: parse with an independently pinned XML parser
 * and enforce the element and attribute allow-lists, copied from the metro-map spec. Run npm test.
 */
import { expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
export const elements=new Set('svg title desc g path line rect circle ellipse polygon polyline text tspan'.split(' '));
export const attributes=new Set('xmlns role viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray opacity fill-opacity stroke-opacity font-family font-size font-weight text-anchor dominant-baseline data-ref data-line data-zone'.split(' '));
// U+FFFD is required output for invalid XML characters; the parser warns on this valid character.
export function parseSvg(svg:string){return new DOMParser({onError:(level,message)=>{if(level!=='warning' || message!=='Unicode replacement character detected, source encoding issues?')throw new Error(`${level}: ${message}`);}}).parseFromString(svg,'image/svg+xml');}
export function safe(svg:string){
 const doc=parseSvg(svg);expect(doc.documentElement.tagName).toBe('svg');expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');expect(doc.documentElement.getAttribute('role')).toBe('img');
 expect(svg).not.toMatch(/<!DOCTYPE|<!ENTITY|<\?/i);
 for(const element of Array.from(doc.getElementsByTagName('*'))){expect(elements.has(element.tagName),element.tagName).toBe(true);for(const attr of Array.from(element.attributes)){expect(attributes.has(attr.name),attr.name).toBe(true);if(['fill','stroke'].includes(attr.name))expect(attr.value).toMatch(/^(?:#[0-9A-Fa-f]{6}|none)$/);expect(attr.value).not.toMatch(/url\(/i);}}
 return doc;
}
