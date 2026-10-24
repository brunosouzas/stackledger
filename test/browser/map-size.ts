/** Measures a map page for catalogue-site "Map shown size" and skills-site "Skills map shown size":
 * the light map's shown size, its initial viewBox size, the frame's content box and the frame's
 * distances to the edges of the content column (the frame's parent). Measured in the browser.
 * The initial viewBox size is read from the SVG's width and height attributes, which the engine writes
 * equal to it (src/map/svg.ts) and which zoom never changes (site/src/scripts/map.ts edits the viewBox).
 */
import type { Page } from '@playwright/test';

export interface MapSize {
  width: number; height: number;
  viewBoxWidth: number; viewBoxHeight: number;
  frameContentWidth: number;
  leftGap: number; rightGap: number;
  pageScrolls: boolean;
}

export async function mapSize(page: Page): Promise<MapSize> {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('.map-canvas.themed-light svg')!;
    const frame = svg.closest<HTMLElement>('[data-map]')!;
    const column = frame.parentElement!;
    const box = svg.getBoundingClientRect();
    const outer = frame.getBoundingClientRect();
    const columnBox = column.getBoundingClientRect();
    const columnStyle = getComputedStyle(column);
    return {
      width: box.width, height: box.height,
      viewBoxWidth: Number(svg.getAttribute('width')), viewBoxHeight: Number(svg.getAttribute('height')),
      frameContentWidth: frame.clientWidth,
      leftGap: outer.left - (columnBox.left + parseFloat(columnStyle.paddingLeft)),
      rightGap: columnBox.right - parseFloat(columnStyle.paddingRight) - outer.right,
      pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}
