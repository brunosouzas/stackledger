/** Strict XML text writer used by the SVG renderer; npm test parses hostile output.
 * Names are fixed allow-lists; paints must be six-digit hex or none; nonfinite geometry
 * throws rather than producing invalid SVG. Catalogue strings are always XML escaped.
 */
const elements=new Set('svg title desc g path line rect circle ellipse polygon polyline text tspan'.split(' '));
const attributes=new Set('xmlns role viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray opacity fill-opacity stroke-opacity font-family font-size font-weight text-anchor dominant-baseline data-ref'.split(' '));
export function escapeXml(text:string):string{
  return Array.from(text,char=>{const code=char.codePointAt(0)!;return code===9 || code===10 || code===13 || (code>=32 && code<=0xD7FF) || (code>=0xE000 && code<=0xFFFD) || code>=0x10000?char:'\uFFFD';}).join('').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
}
export function number(value:number):string{if(!Number.isFinite(value))throw new Error('SVG geometry must be finite');return String(Math.round(value*100)/100);}
export function color(value:string):string{if(!/^(?:#[0-9a-fA-F]{6}|none)$/.test(value))throw new Error('SVG colour must be #RRGGBB or none');return value;}
export type Attributes=Record<string,string|number>;
export function tag(name:string,attrs:Attributes={},children?:string):string{
  if(!elements.has(name))throw new Error('Unsupported SVG element');
  const values=Object.entries(attrs).map(([key,value])=>{if(!attributes.has(key))throw new Error('Unsupported SVG attribute');
    const text=typeof value==='number'?number(value):['fill','stroke'].includes(key)?color(value):value;
    return ` ${key}="${escapeXml(text)}"`;}).join('');
  return children===undefined?`<${name}${values}/>`:`<${name}${values}>${children}</${name}>`;
}
