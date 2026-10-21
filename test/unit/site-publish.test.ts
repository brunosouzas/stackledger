/** publish.ts and staging.ts on hand-made output folders, with a wrapped FsOps (test/fs-wrapper.mjs)
 * that fails or swaps the output folder at every step: the undo, a failed undo and the documented
 * manual restore, the refusals of staging folders, and the identity check before each change
 * (build-command: Atomic replace, Interrupted publication, Output folder identity). The whole
 * command is covered by test/integration/build.test.ts. Run npm test. Contents are fictitious.
 */
import { describe, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { InternalError } from '../../src/errors.js';
import { NODE_FS, type FsOps } from '../../src/site/fs-ops.js';
import { FolderChanged, folderIdentity, type FolderIdentity } from '../../src/site/paths.js';
import { MARKER, MARKER_NAME } from '../../src/site/policy.js';
import { publish, UndoFailed } from '../../src/site/publish.js';
import { FULL_ONLY, removeStaging, staleStaging } from '../../src/site/staging.js';
import { wrapOps } from '../fs-wrapper.mjs';
import { folder } from '../helpers.js';
import { manualRestore } from '../manual-restore.js';

/** The plan test/fs-wrapper.mjs documents. */
interface Fault { op: keyof FsOps; nth: number }
interface Swap { to: string; kind: 'link' | 'folder'; after?: Fault; atCheck?: number }
interface Plan { out: string; fail?: Fault[] | undefined; swap?: Swap }
interface Wrapper { ops: FsOps; changesAfterSwap: string[]; swapped: () => boolean }
const wrap = (plan: Plan) => wrapOps(NODE_FS, plan) as unknown as Wrapper;

const STAGING = '.stackledger-tmp-test';
const PREVIOUS = {
  'staff/index.html': 'old staff\n', 'full/index.html': 'old full\n', '_headers': 'old headers\n', 'robots.txt': 'old robots\n',
  '_redirects': '/ /staff/ 302\n', [MARKER_NAME]: MARKER,
};
const PREPARED = {
  'site-staff/index.html': 'new staff\n', 'site-full/index.html': 'new full\n',
  'root/_headers': 'new headers\n', 'root/robots.txt': 'new robots\n', 'root/_redirects': '/ /staff/ 302\n', [`root/${MARKER_NAME}`]: MARKER,
};
/** A personal build (spec.sites: [full]): no staff site, and the full-only note that says so. */
const { 'site-staff/index.html': _staff, ...PERSONAL_BASE } = PREPARED;
const PERSONAL = { ...PERSONAL_BASE, 'root/_redirects': '/ /full/ 302\n', [FULL_ONLY]: '' };

function write(dir: string, files: Record<string, string>): string {
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

/** An output folder (with an earlier build unless `previous` is false), its staging folder holding a
 * prepared build, and another folder that a swap puts in its place. */
function fixture(previous = true, prepared: Record<string, string> = PREPARED) {
  const base = realpathSync(folder());
  const out = write(join(base, 'out'), previous ? PREVIOUS : {});
  const staging = write(join(out, STAGING), prepared);
  const other = write(join(base, 'other'), { [MARKER_NAME]: MARKER, 'staff/index.html': 'another site\n' });
  return { base, out, staging, other };
}

/** Every entry under `dir` (links recorded, never followed) as path -> 'dir', 'link:…' or a hash. */
function snapshot(dir: string, skip: (path: string) => boolean = () => false): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: false }).map(String).sort()) {
    if (skip(entry)) continue;
    const path = join(dir, entry);
    const stats = NODE_FS.lstat(path);
    if (stats.isSymbolicLink()) result[entry] = `link:${readlinkSync(path)}`;
    else if (stats.isDirectory()) result[entry] = 'dir';
    else result[entry] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return result;
}
const published = (out: string) => snapshot(out, path => path.startsWith('.stackledger-tmp-'));

// A rebuild renames 12 times (old then new, for staff, full, _headers, robots.txt, _redirects and the marker).
const RENAMES = Array.from({ length: 12 }, (_, i) => i + 1);
// A personal build over a corporate one renames 11 times: the old staff into old/, then the rest as above.
const PERSONAL_RENAMES = Array.from({ length: 11 }, (_, i) => i + 1);

describe('Atomic replace', () => {
  test('A publication puts every new entry in place and the replaced ones under old/', () => {
    const { out, staging } = fixture();
    publish(out, staging, folderIdentity(out));
    expect(readFileSync(join(out, 'full', 'index.html'), 'utf8')).toBe('new full\n');
    expect(readdirSync(join(staging, 'old')).sort()).toEqual([MARKER_NAME, '_headers', '_redirects', 'full', 'robots.txt', 'staff']);
  });

  test('Stale staff site removed: a personal build moves the old staff/ into old/ and publishes no staff/', () => {
    const { out, staging } = fixture(true, PERSONAL);
    publish(out, staging, folderIdentity(out));
    expect(readdirSync(out).filter(name => !name.startsWith('.stackledger-tmp-')).sort()).toEqual([MARKER_NAME, '_headers', '_redirects', 'full', 'robots.txt']);
    expect(readFileSync(join(out, '_redirects'), 'utf8')).toBe('/ /full/ 302\n');
    expect(readFileSync(join(staging, 'old', 'staff', 'index.html'), 'utf8')).toBe('old staff\n');
  });

  test('A missing staff site without the full-only note is a failure, undone', () => {
    const { 'site-staff/index.html': _, ...missing } = PREPARED;
    const { out, staging } = fixture(true, missing);
    const before = published(out);
    expect(() => publish(out, staging, folderIdentity(out))).toThrow();
    expect(published(out)).toEqual(before);
  });

  test.each(PERSONAL_RENAMES)('A failed personal build leaves the corporate site (rename %i)', nth => {
    const { out, staging } = fixture(true, PERSONAL);
    const before = published(out);
    const { ops } = wrap({ out, fail: [{ op: 'rename', nth }] });
    expect(() => publish(out, staging, folderIdentity(out), ops)).toThrow(`injected rename failure (call ${nth})`);
    expect(published(out)).toEqual(before);
  });

  test.each(RENAMES)('Failure leaves the old site (rename %i): every rename is undone', nth => {
    const { out, staging } = fixture();
    const before = published(out);
    const { ops } = wrap({ out, fail: [{ op: 'rename', nth }] });
    expect(() => publish(out, staging, folderIdentity(out), ops)).toThrow(`injected rename failure (call ${nth})`);
    expect(published(out)).toEqual(before);
    expect(readdirSync(join(staging, 'old'))).toEqual([]);
  });

  test('old/ is created just before the first rename; its failure changes nothing', () => {
    const { out, staging } = fixture();
    const before = snapshot(out);
    const { ops } = wrap({ out, fail: [{ op: 'mkdir', nth: 1 }] });
    expect(() => publish(out, staging, folderIdentity(out), ops)).toThrow('injected mkdir failure');
    expect(snapshot(out)).toEqual(before);
  });
});

describe('Interrupted publication', () => {
  const UNDO_FAILED = /^stackledger build: publication failed \(injected rename failure \(call \d+\)\) and could not be undone \(injected rename failure \(call \d+\)\); the previous entries are in .*old\. The staging folder .* was kept: restore by hand as docs\/site\.md, section "Restoring after a failed publication" explains/;

  // Rename 1 has nothing to undo; from rename 2 on, the first undo rename (the next call) fails too.
  test.each(RENAMES.slice(1))('Undo failed (rename %i): the staging folder keeps old/ and the manual restore brings the old site back', nth => {
    const { out, staging } = fixture();
    const before = published(out);
    const { ops } = wrap({ out, fail: [{ op: 'rename', nth }, { op: 'rename', nth: nth + 1 }] });
    const error = (() => {
      try {
        publish(out, staging, folderIdentity(out), ops);
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(UndoFailed);
    expect((error as Error).message).toMatch(UNDO_FAILED);
    expect((error as Error).message).toContain(staging);
    expect(readdirSync(join(staging, 'old')).length).toBeGreaterThan(0);
    manualRestore(out, staging);
    expect(snapshot(out)).toEqual(before);
  });

  // Personal over corporate: rename 1 moves the old staff into old/; from rename 2 on, the undo fails too.
  test.each(PERSONAL_RENAMES.slice(1))('Undo failed in a personal build (rename %i): the manual restore brings the corporate site back', nth => {
    const { out, staging } = fixture(true, PERSONAL);
    const before = published(out);
    const { ops } = wrap({ out, fail: [{ op: 'rename', nth }, { op: 'rename', nth: nth + 1 }] });
    expect(() => publish(out, staging, folderIdentity(out), ops)).toThrow(UndoFailed);
    manualRestore(out, staging);
    expect(snapshot(out)).toEqual(before);
  });

  test('Personal publication stopped after old/ was created, before any rename: the manual restore keeps the published staff/', () => {
    const { out, staging } = fixture(true, PERSONAL);
    const before = published(out);
    // A process killed right after creating old/: old/ is empty, the staged entries are all there and
    // staff/ was never moved. The restore must not delete it, although site-staff is not staged.
    mkdirSync(join(staging, 'old'));
    manualRestore(out, staging);
    expect(snapshot(out)).toEqual(before);
  });

  test('An undo that fails halfway stops there; the manual restore still works', () => {
    const { out, staging } = fixture();
    const before = published(out);
    // Renames 1-5 done, 6 fails, undo renames 7 (ok) and 8 (fails): the undo stops.
    const { ops } = wrap({ out, fail: [{ op: 'rename', nth: 6 }, { op: 'rename', nth: 8 }] });
    expect(() => publish(out, staging, folderIdentity(out), ops)).toThrow(UndoFailed);
    manualRestore(out, staging);
    expect(snapshot(out)).toEqual(before);
  });

  test('A first build whose undo failed is restored to an empty folder', () => {
    const { out, staging } = fixture(false);
    const { ops } = wrap({ out, fail: [{ op: 'rename', nth: 3 }, { op: 'rename', nth: 4 }] });
    expect(() => publish(out, staging, folderIdentity(out), ops)).toThrow(UndoFailed);
    manualRestore(out, staging);
    expect(readdirSync(out)).toEqual([]);
  });

  test('Stale staging before publication: only real folders without old/ are removed, links inside are not followed', () => {
    const { out, other } = fixture();
    const crashed = write(join(out, '.stackledger-tmp-crashed'), { 'site-full/index.html': 'full view\n' });
    symlinkSync(other, join(crashed, 'site-staff'));
    const otherBefore = snapshot(other);
    const stale = staleStaging(out, readdirSync(out));
    expect(stale).toEqual([crashed, join(out, STAGING)]);
    removeStaging(stale, folderIdentity(out));
    expect(readdirSync(out).sort()).toEqual(Object.keys(PREVIOUS).map(path => path.split('/')[0]).sort());
    expect(snapshot(other)).toEqual(otherBefore);
  });

  test.each([
    ['a folder', (path: string) => mkdirSync(path)],
    ['a file', (path: string) => writeFileSync(path, 'x\n')],
    ['a symbolic link', (path: string) => symlinkSync('/nonexistent-target', path)],
  ])('Next build after a failed undo: a staging folder whose old is %s is refused, nothing changes', (_, make) => {
    const { out } = fixture();
    const kept = write(join(out, '.stackledger-tmp-kept'), { 'site-full/index.html': 'new full\n' });
    make(join(kept, 'old'));
    const before = snapshot(out);
    const refuse = () => staleStaging(out, readdirSync(out));
    expect(refuse).toThrow(InternalError);
    expect(refuse).toThrow(`stackledger build: ${kept} holds entries that an earlier publication replaced (its old/ folder); nothing was changed. Restore them by hand as docs/site.md, section "Restoring after a failed publication" explains, then remove that folder`);
    expect(snapshot(out)).toEqual(before);
  });

  test.each([
    ['a symbolic link to a folder', (path: string, other: string) => symlinkSync(other, path)],
    ['a file', (path: string) => writeFileSync(path, 'x\n')],
  ])('A .stackledger-tmp-* entry that is %s is refused as a usage error, nothing changes', (_, make) => {
    const { out, other } = fixture();
    make(join(out, '.stackledger-tmp-odd'), other);
    const before = snapshot(out);
    const otherBefore = snapshot(other);
    let error: unknown;
    try {
      staleStaging(out, readdirSync(out));
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(InternalError);
    expect((error as Error).message).toBe('Output folder entry .stackledger-tmp-odd is a symbolic link or not a folder; stackledger build removes only its own staging folders, so remove it by hand');
    expect(snapshot(out)).toEqual(before);
    expect(snapshot(other)).toEqual(otherBefore);
  });
});

describe('Output folder identity', () => {
  const KINDS = ['link', 'folder'] as const;
  type Act = (ops: FsOps, out: string, staging: string, identity: FolderIdentity) => void;
  const publishing: Act = (ops, out, staging, identity) => publish(out, staging, identity, ops);

  /** Run `act` with the output folder swapped at the planned point: it must throw FolderChanged,
   * change nothing after the swap, and leave the other folder untouched (at its own place behind a
   * link, or at `out` when the folder itself was moved there). */
  function expectStopped(kind: typeof KINDS[number], swap: Pick<Swap, 'after' | 'atCheck'>, act: Act, fail?: Fault[]): void {
    const { out, staging, other } = fixture();
    const otherBefore = snapshot(other);
    const identity = folderIdentity(out);
    const wrapper = wrap({ out, fail, swap: { ...swap, to: other, kind } });
    expect(() => act(wrapper.ops, out, staging, identity)).toThrow(FolderChanged);
    expect(wrapper.swapped()).toBe(true);
    expect(wrapper.changesAfterSwap).toEqual([]);
    expect(snapshot(kind === 'link' ? other : out)).toEqual(otherBefore);
  }

  describe.each(KINDS)('Folder swapped during a build (to a %s)', kind => {
    test('before old/ is created', () => expectStopped(kind, { atCheck: 1 }, publishing));

    test('after old/ is created', () => expectStopped(kind, { after: { op: 'mkdir', nth: 1 } }, publishing));

    // A swap after any publication rename but the last (the commit) is caught before the next one.
    test.each(RENAMES.slice(0, -1))('after publication rename %i', nth => expectStopped(kind, { after: { op: 'rename', nth } }, publishing));

    // Rename 6 fails; renames 7-11 undo renames 5-1. A swap after any undo rename but the last stops the undo.
    test.each([7, 8, 9, 10])('between undo renames (after rename %i)', nth => {
      expectStopped(kind, { after: { op: 'rename', nth } }, publishing, [{ op: 'rename', nth: 6 }]);
    });

    test('before a stale staging folder is removed', () => {
      expectStopped(kind, { atCheck: 1 }, (ops, out, _, identity) => removeStaging([join(out, STAGING)], identity, ops));
    });
  });
});
