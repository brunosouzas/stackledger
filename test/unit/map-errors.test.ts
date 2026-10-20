/** Internal map failures exit 1 with one line; usage errors keep exit 2. Run npm test. */
import { test, expect, vi } from 'vitest';
import { join } from 'node:path';
import { InternalError, reportFailure } from '../../src/errors.js';
import { mapCommand } from '../../src/map/command.js';

vi.mock('../../src/map/layout.js', () => ({
  layoutMap: () => { throw new Error('geometry\nexploded'); },
}));

const example = join(import.meta.dirname, '../../examples/northwind');

test('An internal layout failure is an InternalError with no stdout',async()=>{
 const write=vi.spyOn(process.stdout,'write').mockImplementation(()=>true);
 try{
  const error=await mapCommand(['map',example,'--date','2027-06-01']).then(()=>undefined,(e:unknown)=>e);
  expect(error).toBeInstanceOf(InternalError);
  expect((error as Error).message).toBe('stackledger map: internal error: geometry exploded');
  expect(write).not.toHaveBeenCalled();
 }finally{write.mockRestore();}
});
test('Internal failures exit 1 without usage; usage failures exit 2 with usage',()=>{
 expect(reportFailure(new InternalError('stackledger map: internal error: boom'),'Usage: x\n')).toEqual({stderr:'stackledger map: internal error: boom\n',exitCode:1});
 expect(reportFailure(new Error('Unknown theme'),'Usage: x\n')).toEqual({stderr:'Unknown theme\nUsage: x\n',exitCode:2});
});
test('Argument errors stay usage errors even with a broken layout',async()=>{
 const error=await mapCommand(['map',example,'--theme','neon']).then(()=>undefined,(e:unknown)=>e);
 expect(error).not.toBeInstanceOf(InternalError);expect(reportFailure(error,'U\n').exitCode).toBe(2);
});
