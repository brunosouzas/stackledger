/** All visual constants for the two supported themes. renderSvg consumes only Theme data.
 * Extend data for later styles; no name-based renderer branches. Light/dark casing and
 * hard offset shadows are off. No fonts or other assets are fetched at render time.
 */
export interface Theme {
  background:string;text:string;muted:string;grid:string;header:string;headerText:string;station:string;outline:string;
  licence:string;renewal:string;badgeText:string;panel:string;font:string;lineWidth:number;zoneOpacity:number;
  casing:{enabled:boolean;color:string;extraWidth:number};
  shadow:{enabled:boolean;color:string;dx:number;dy:number};
}
export const themes:Readonly<Record<'light'|'dark',Theme>>={
  light:{background:'#FFFFFF',text:'#111827',muted:'#9299A6',grid:'#DCE7F5',header:'#000F9F',headerText:'#FFFFFF',station:'#FFFFFF',outline:'#111827',
    licence:'#A87800',renewal:'#F5A300',badgeText:'#FFFFFF',panel:'#FFFFFF',font:'Avenir Next, Helvetica Neue, Arial, sans-serif',lineWidth:7,zoneOpacity:0.09,
    casing:{enabled:false,color:'#0A1033',extraWidth:4},shadow:{enabled:false,color:'#0A1033',dx:4,dy:4}},
  dark:{background:'#16181D',text:'#F1F3F8',muted:'#848C9B',grid:'#2A303D',header:'#0B1440',headerText:'#FFFFFF',station:'#16181D',outline:'#F1F3F8',
    licence:'#E5B84B',renewal:'#F5A300',badgeText:'#FFFFFF',panel:'#16181D',font:'Avenir Next, Helvetica Neue, Arial, sans-serif',lineWidth:7,zoneOpacity:0.18,
    casing:{enabled:false,color:'#0A1033',extraWidth:4},shadow:{enabled:false,color:'#0A1033',dx:4,dy:4}},
};
