/** Sources `brew` and `cask`: Homebrew formulae and casks from one sandboxed run of
 * `brew info --json=v2 --installed` (mac-discovery spec, Homebrew; design D1, owner question 6).
 *
 * With HOMEBREW_NO_AUTO_UPDATE (set by the runner) Homebrew reads its cached API files and needs no
 * network. Output that is not an object with `formulae` and `casks` lists fails both sources with
 * `unreadable output`; an entry without a non-empty string name or installed version is ignored;
 * optional fields of the wrong type are treated as absent.
 */
import type { Host } from '../host.js';
import { failureReason } from '../run.js';
import { failed, ok, skipped, type BrewItem, type CaskItem, type SourceResult } from '../types.js';
import { isRecord, nonEmptyString } from './common.js';

export const BREW_ARGS = ['info', '--json=v2', '--installed'];

function formula(entry: unknown): BrewItem | undefined {
  if (!isRecord(entry) || !nonEmptyString(entry.full_name) || !Array.isArray(entry.installed) || !entry.installed.length) return undefined;
  const versions: string[] = [], dependsOn: string[] = [];
  let onRequest = false;
  for (const installed of entry.installed) {
    if (!isRecord(installed) || !nonEmptyString(installed.version)) return undefined;
    versions.push(installed.version);
    if (installed.installed_on_request === true) onRequest = true;
    if (Array.isArray(installed.runtime_dependencies)) for (const dependency of installed.runtime_dependencies) {
      if (isRecord(dependency) && dependency.declared_directly === true && nonEmptyString(dependency.full_name)) dependsOn.push(dependency.full_name);
    }
  }
  return { source: 'brew', id: entry.full_name, versions, onRequest, dependsOn };
}

/** The `.app` names a cask installs: each `app` artifact's source, or its `target` when one is given. */
function caskApps(artifacts: unknown): string[] {
  if (!Array.isArray(artifacts)) return [];
  const apps: string[] = [];
  for (const artifact of artifacts) {
    if (!isRecord(artifact) || !Array.isArray(artifact.app)) continue;
    const [name, options] = artifact.app as unknown[];
    const target = isRecord(options) && nonEmptyString(options.target) ? options.target.split('/').at(-1) : undefined;
    const app = target || (nonEmptyString(name) ? name.split('/').at(-1) : undefined);
    if (app) apps.push(app);
  }
  return apps;
}

function cask(entry: unknown): CaskItem | undefined {
  if (!isRecord(entry) || !nonEmptyString(entry.full_token) || !nonEmptyString(entry.installed)) return undefined;
  return { source: 'cask', id: entry.full_token, versions: [entry.installed], apps: caskApps(entry.artifacts) };
}

export async function readBrew(host: Host): Promise<{ brew: SourceResult; cask: SourceResult }> {
  const result = await host.run('brew', BREW_ARGS);
  if (result.kind === 'not found') return { brew: skipped('brew'), cask: skipped('cask') };
  const reason = failureReason(result);
  if (reason || result.kind !== 'exited') return { brew: failed('brew', reason ?? 'unreadable output'), cask: failed('cask', reason ?? 'unreadable output') };
  let parsed: unknown;
  try { parsed = JSON.parse(result.stdout); } catch { parsed = undefined; }
  if (!isRecord(parsed) || !Array.isArray(parsed.formulae) || !Array.isArray(parsed.casks)) {
    return { brew: failed('brew', 'unreadable output'), cask: failed('cask', 'unreadable output') };
  }
  const formulae = parsed.formulae.map(formula), casks = parsed.casks.map(cask);
  const recorded = <T>(values: (T | undefined)[]) => values.filter((value): value is T => value !== undefined);
  return {
    brew: ok('brew', recorded(formulae), formulae.filter(value => !value).length),
    cask: ok('cask', recorded(casks), casks.filter(value => !value).length),
  };
}
