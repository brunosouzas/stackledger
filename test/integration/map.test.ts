/** Every map-command scenario against the built CLI, including a real permission sandbox.
 * Run npm run build && npm test; catalogues and hashes contain only synthetic inventory.
 */
import { test, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { run, root } from './helpers.js';
import { folder } from '../helpers.js';
import { component, line, layout, set } from '../unit/helpers.js';
import { stringify } from 'yaml';
import { validateFolder } from '../../src/validate.js';
import { applyView, resolveHidden } from '../../src/views.js';
import { buildMapModel } from '../../src/map/model.js';
import { layoutMap } from '../../src/map/layout.js';
import { renderSvg } from '../../src/map/svg.js';
import { themes } from '../../src/map/themes.js';
import { localDate } from '../../src/graph.js';
const yaml=(...docs:unknown[])=>docs.map(d=>stringify(d)).join('---\n');
const fixture=()=>folder({'catalogue.yaml':yaml(component('a'),component('b'),line(),layout())});
const parse=(svg:string)=>new DOMParser({onError:(level,message)=>{throw new Error(`${level}: ${message}`);}}).parseFromString(svg,'image/svg+xml');
function hashes(path:string):Record<string,string>{return Object.fromEntries(readdirSync(path,{recursive:true}).map(String).filter(p=>statSync(join(path,p)).isFile()).sort().map(p=>[p,createHash('sha256').update(readFileSync(join(path,p))).digest('hex')]));}
test('Default options',async()=>{const f=fixture(),r=run(['map',f]);expect(r.status).toBe(0);expect(r.stderr).toBe('');parse(r.stdout);const c=await validateFolder(f);expect(r.stdout).toBe(renderSvg(layoutMap(buildMapModel(applyView(c.served,'full',resolveHidden(c)),localDate())),themes.light)+'\n');});
test('Read-only',()=>{
 const f=fixture(),before=hashes(f),flags=['--permission',`--allow-fs-read=${join(root,'dist')}`,`--allow-fs-read=${join(root,'node_modules')}`,`--allow-fs-read=${f}`];
 const plain=run(['map',f,'--date','2027-06-01']),restricted=run(['map',f,'--date','2027-06-01'],root,flags);expect(restricted).toEqual(plain);expect(restricted.status).toBe(0);expect(hashes(f)).toEqual(before);
 const probe=spawnSync(process.execPath,[...flags,'-e','require("node:fs").writeFileSync(process.argv[1],"denied")',join(f,'forbidden')],{encoding:'utf8'});expect(probe.status).not.toBe(0);expect(probe.stderr).toContain('ERR_ACCESS_DENIED');expect(hashes(f)).toEqual(before);
 if(spawnSync(process.execPath,['--help'],{encoding:'utf8'}).stdout.includes('--allow-net')){const network=spawnSync(process.execPath,[...flags,'-e','fetch("https://example.invalid").catch(e=>{console.error(e.cause?.code ?? e.code);process.exitCode=1})'],{encoding:'utf8'});expect(network.status).not.toBe(0);expect(network.stderr).toContain('ERR_ACCESS_DENIED');}
});
test('Unknown theme',()=>{const r=run(['map',fixture(),'--theme','blue']);expect(r.status).toBe(2);expect(r.stdout).toBe('');expect(r.stderr).toContain('allowed themes: light, dark');expect(r.stderr).toContain('Usage:');});
test('Impossible date',()=>{const r=run(['map',fixture(),'--date','2027-02-30']);expect(r.status).toBe(2);expect(r.stdout).toBe('');expect(r.stderr).toContain('real YYYY-MM-DD');});
test('Map usage errors print a reason and usage on stderr only',()=>{
 const f=fixture(),locked=folder();chmodSync(locked,0);
 for(const args of [['map'],['map',f,'--fast'],['map',f,'--view','finance'],['map',f,f],['map',join(f,'absent')],['map',join(f,'catalogue.yaml')],['map',locked],['map',f,'--date','2027-6-01'],['map',f,'--theme'],['map',f,'--view'],['map',f,'--date']]){
  const r=run(args);expect(r.status,args.join(' ')).toBe(2);expect(r.stdout).toBe('');expect(r.stderr).toMatch(/.+\nUsage:/);
 }
});
test('Map help wins over invalid arguments',()=>{const r=run(['map','--theme','blue','--help','a','b']);expect(r.status).toBe(0);expect(r.stdout).toContain('stackledger map <folder>');expect(r.stderr).toBe('');});
test('One error in full',()=>{const f=folder({'catalogue.yaml':yaml(component('a'),component('b'),line(),layout(),set(component('broken'),'spec.owner',undefined))});const r=run(['map',f]);expect(r.status).toBe(0);parse(r.stdout);expect(r.stderr).toBe('stackledger map: 1 error, 0 warnings; run stackledger validate for details\n');expect(run(['map',f,'--view','staff']).stderr).toBe('');});
test('Clean catalogue',()=>{const r=run(['map',fixture()]);expect(r.status).toBe(0);expect(r.stderr).toBe('');});
test('Broken layout',()=>{const f=folder({'catalogue.yaml':yaml(component('a'),component('b'),line(),set(layout(),'spec.stations',{'component:a':[2.5,1]}))});for(const view of ['full','staff']){const r=run(['map',f,'--view',view]);expect(r.status).toBe(0);expect(r.stderr).toContain('Stored positions are not used because the layout has errors\n');expect(r.stderr).toContain('    component:a: [0, 0]\n    component:b: [1, 0]\n');parse(r.stdout);}});
test('Two unplaced stops',()=>{const f=folder({'catalogue.yaml':yaml(component('b'),component('a'),line())}),r=run(['map',f,'--view','staff']);expect(r.status).toBe(0);expect(r.stderr).toBe('Suggested positions for MapLayout spec.stations:\n    component:a: [0, 0]\n    component:b: [1, 0]\n');});
test('Unroutable hop',()=>{const f=folder({'catalogue.yaml':yaml(component('a'),component('b'),line(),set(layout(),'spec.stations',{'component:a':[0,0],'component:b':[100000,100000]}))}),r=run(['map',f]);expect(r.status).toBe(0);expect(r.stderr).toBe('Unrouted hop: line:ship component:a -> component:b (drawn straight)\n');parse(r.stdout);});
test('Parseable output',()=>{const f=folder({'catalogue.yaml':yaml(component('a'),component('b'),line(),set(component('broken'),'spec.owner',undefined))}),r=run(['map',f]);expect(r.status).toBe(0);const doc=parse(r.stdout);expect(doc.documentElement.tagName).toBe('svg');expect(r.stdout).toMatch(/^<svg[\s\S]*<\/svg>\n$/);expect(r.stdout).not.toContain('Suggested positions');expect(r.stderr).toContain('1 error');expect(r.stderr).toContain('Suggested positions');});
test('Global help lists both commands',()=>{const r=run(['--help']);expect(r.status).toBe(0);for(const c of ['validate','mcp','map'])expect(r.stdout).toContain(`stackledger ${c}`);});
test('Explicit staff and dark options select their output',()=>{const r=run(['map',fixture(),'--view','staff','--theme','dark','--date','2027-06-01']);expect(r.status).toBe(0);expect(r.stderr).toBe('');expect(r.stdout).toContain(`fill="${themes.dark.background}"`);expect(parse(r.stdout).documentElement.textContent).toContain('staff view');expect(r.stdout).not.toContain('Renewal within 30 days');});
test('Map library bundles for the browser without Node filesystem imports',()=>{
 // esbuild is already pinned in the existing Vite development dependency graph.
 const source=['model:buildMapModel','layout:layoutMap','svg:renderSvg'].map(entry=>{const [file,name]=entry.split(':');return `export { ${name} } from './src/map/${file}.ts';`;}).join('\n');
 const result=spawnSync(join(root,'node_modules/.bin/esbuild'),['--bundle','--platform=browser','--format=esm','--loader=ts'],{cwd:root,input:source,encoding:'utf8'});
 expect(result.error).toBeUndefined();expect(result.status,result.stderr).toBe(0);for(const name of ['buildMapModel','layoutMap','renderSvg'])expect(result.stdout).toContain(name);expect(result.stdout).not.toContain('node:fs');
});
