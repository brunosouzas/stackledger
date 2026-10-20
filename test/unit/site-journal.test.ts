/** journal.ts and clearStaging (publish.ts) on hand-made output folders: which staging folders are
 * removed, which interrupted publications are finished, and when the build refuses and deletes
 * nothing (build-command, Atomic replace). Run npm test. Folder names and contents are fictitious.
 */
import { test, expect } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { interrupted, pendingMoves, readJournal, type JournalRecord } from '../../src/site/journal.js';
import { clearStaging } from '../../src/site/publish.js';
import { folder } from '../helpers.js';

const lines = (...records: JournalRecord[]) => records.map(record => JSON.stringify(record) + '\n').join('');
const move = (index: number, from: string, to: string): JournalRecord => ({ kind: 'move', index, from, to });

test('A partial last line is ignored; any other bad line makes the journal unreadable', () => {
  const out = folder({
    'a/journal': lines(move(1, 'staff', 'x/old/staff')) + '{"kind":"mo',
    'b/journal': '{"kind":"jump"}\n',
  });
  expect(readJournal(join(out, 'a'))).toEqual([move(1, 'staff', 'x/old/staff')]);
  expect(() => readJournal(join(out, 'b'))).toThrow(/line 1 is not a journal record/);
  expect(readJournal(out)).toBeUndefined();
});

test('Only a publication with neither commit nor undone is interrupted; undone renames are not pending', () => {
  const records = [move(1, 'staff', 's/old/staff'), move(2, 's/site-staff', 'staff'), { kind: 'unmoved', index: 2 } as const, move(3, 'full', 's/old/full')];
  expect(interrupted(records)).toBe(true);
  expect(interrupted([...records, { kind: 'commit' }])).toBe(false);
  expect(interrupted([...records, { kind: 'undone' }])).toBe(false);
  expect(interrupted([])).toBe(false);
  expect(pendingMoves(records).map(step => step.index)).toEqual([3, 1]);
});

test('Staging folders without an interrupted publication are removed; links are unlinked, never followed', () => {
  const elsewhere = folder({ 'keep.txt': 'keep me\n' });
  const out = folder({
    'staff/index.html': 'staff\n',
    '.stackledger-tmp-crashed/site-full/index.html': 'full\n',
    '.stackledger-tmp-committed/journal': lines(move(1, 'staff', '.stackledger-tmp-committed/old/staff'), { kind: 'commit' }),
    '.stackledger-tmp-undone/journal': lines(move(1, 'staff', '.stackledger-tmp-undone/old/staff'), { kind: 'undone' }),
  });
  symlinkSync(elsewhere, join(out, '.stackledger-tmp-link'));
  expect(clearStaging(out)).toEqual([]);
  expect(readdirSync(out)).toEqual(['staff']);
  expect(readFileSync(join(elsewhere, 'keep.txt'), 'utf8')).toBe('keep me\n');
});

test('An interrupted publication is finished from its journal before anything is removed', () => {
  const staging = '.stackledger-tmp-cut';
  const out = folder({
    'staff/index.html': 'new staff\n',
    [`${staging}/old/staff/index.html`]: 'old staff\n',
    [`${staging}/journal`]: lines(move(1, 'staff', `${staging}/old/staff`), move(2, `${staging}/site-staff`, 'staff'), move(3, 'full', `${staging}/old/full`)),
    'full/index.html': 'old full\n',
  });
  const changes: string[] = [];
  const notes = clearStaging(out, () => changes.push('change'));
  expect(notes).toEqual([`Note: finished undoing the publication interrupted in ${join(out, staging)}; the earlier build was restored first`]);
  // Move 3 never happened (full is still in place); moves 2 and 1 are undone; then the staging folder goes.
  expect(readFileSync(join(out, 'staff', 'index.html'), 'utf8')).toBe('old staff\n');
  expect(readFileSync(join(out, 'full', 'index.html'), 'utf8')).toBe('old full\n');
  expect(readdirSync(out).sort()).toEqual(['full', 'staff']);
  expect(changes.length).toBeGreaterThan(0);
});

test('A publication that cannot be finished, two of them or an unreadable journal: refused, nothing deleted', () => {
  const cases: Record<string, Record<string, string>> = {
    // Both the old and the new entry exist: the journal cannot say which one belongs in place.
    conflict: {
      'staff/index.html': 'new staff\n',
      '.stackledger-tmp-a/old/staff/index.html': 'old staff\n',
      '.stackledger-tmp-a/site-staff/index.html': 'other\n',
      '.stackledger-tmp-a/journal': lines(move(1, 'staff', '.stackledger-tmp-a/old/staff'), move(2, '.stackledger-tmp-a/site-staff', 'staff')),
    },
    two: {
      '.stackledger-tmp-a/journal': lines(move(1, 'staff', '.stackledger-tmp-a/old/staff')),
      '.stackledger-tmp-b/journal': lines(move(1, 'staff', '.stackledger-tmp-b/old/staff')),
    },
    unreadable: { '.stackledger-tmp-a/journal': 'not json\n', '.stackledger-tmp-old/x': 'x\n' },
    outside: { '.stackledger-tmp-a/journal': lines(move(1, '../elsewhere', '.stackledger-tmp-a/old/x')), '../elsewhere': 'x\n' },
  };
  for (const [label, files] of Object.entries(cases)) {
    const base = folder();
    const out = join(base, 'out');
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(out, path, '..'), { recursive: true });
      writeFileSync(join(out, path), content);
    }
    const before = readdirSync(base, { recursive: true }).map(String).sort();
    expect(() => clearStaging(out), label).toThrow(/nothing was deleted/);
    expect(readdirSync(base, { recursive: true }).map(String).sort(), label).toEqual(before);
  }
});
