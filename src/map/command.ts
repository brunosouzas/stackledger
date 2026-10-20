/** Read-only map command. Called by src/cli.ts; run node dist/cli.js map <folder>.
 * Usage/root failures throw before stdout; recoverable catalogue errors are diagnostics.
 * stdout is exactly one SVG and one newline. No catalogue file is ever changed.
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadFolder } from '../source.js';
import { validateLoaded } from '../validate.js';
import { applyView, resolveHidden, viewNames, type ViewName } from '../views.js';
import { isDate, localDate } from '../graph.js';
import { buildMapModel } from './model.js';
import { layoutMap } from './layout.js';
import { renderSvg } from './svg.js';
import { themes } from './themes.js';
export async function mapCommand(args:string[]):Promise<void>{
  const {values,positionals}=parseArgs({args,strict:true,allowPositionals:true,options:{view:{type:'string'},theme:{type:'string'},date:{type:'string'}}});
  const [,folder,...extra]=positionals;
  if(!folder)throw new Error('A catalogue folder is required');
  if(extra.length)throw new Error('Only one folder is accepted');
  const view=values.view??'full',themeName=values.theme??'light',date=values.date??localDate();
  if(!viewNames.includes(view as ViewName))throw new Error(`Unknown view; allowed views: ${viewNames.join(', ')}`);
  if(themeName!=='light' && themeName!=='dark')throw new Error('Unknown theme; allowed themes: light, dark');
  if(!isDate(date))throw new Error('Map date must be a real YYYY-MM-DD date');
  const loaded=await loadFolder(resolve(folder)),catalogue=validateLoaded(loaded);
  const theme=themes[themeName],geometry=layoutMap(buildMapModel(applyView(catalogue.served,view as ViewName,resolveHidden(catalogue)),date),theme.lineWidth);
  // Render before publishing bytes: unexpected geometry errors must leave stdout empty.
  const svg=renderSvg(geometry,theme),diagnostics:string[]=[];
  const {errors,warnings}=catalogue.summary;
  if(view==='full' && (errors || warnings))diagnostics.push(`stackledger map: ${errors} ${errors===1?'error':'errors'}, ${warnings} ${warnings===1?'warning':'warnings'}; run stackledger validate for details`);
  if(!catalogue.served.layouts.length && loaded.sources.some(s=>s.value.kind==='MapLayout'))diagnostics.push('Stored positions are not used because the layout has errors');
  if(geometry.suggestions.length){diagnostics.push('Suggested positions for MapLayout spec.stations:');for(const s of geometry.suggestions)diagnostics.push(`    ${s.ref}: [${s.point[0]}, ${s.point[1]}]`);}
  for(const hop of geometry.unrouted)for(const line of hop.lines)diagnostics.push(`Unrouted hop: ${line} ${hop.from} -> ${hop.to} (drawn straight)`);
  if(diagnostics.length)process.stderr.write(diagnostics.join('\n')+'\n');
  process.stdout.write(svg+'\n');
}
