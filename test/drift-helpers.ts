/** Fictitious snapshots and components for the drift and scaffold tests. Run through npm test.
 *
 * Why: drift and scaffold are pure functions of a snapshot and catalogue components, so their unit
 * tests build both in memory. `snapshotOf` fills in the eight sources (status `ok` unless given) and
 * keeps the snapshot consistent (items counted per source, sorted as discovery sorts them), so every
 * test snapshot also passes checkSnapshot. Northwind names only; the user is `username`.
 */
import { SOURCES, type SourceName } from '../src/discovery/annotations.js';
import { compareItems, type Snapshot, type SnapshotSource } from '../src/discovery/snapshot.js';
import type { Item, Status } from '../src/discovery/types.js';
import type { Component } from '../src/schema.js';

export const TAKEN_AT = '2026-10-21T07:30:00Z';

export const brew = (id: string, fields: { onRequest?: boolean; dependsOn?: string[]; versions?: string[] } = {}): Item =>
  ({ source: 'brew', id, versions: fields.versions ?? ['1.0.0'], onRequest: fields.onRequest ?? true, dependsOn: fields.dependsOn ?? [] });
export const cask = (id: string, apps: string[] = [], versions = ['1.0.0']): Item => ({ source: 'cask', id, versions, apps });
export const mas = (id: string, title: string): Item => ({ source: 'mas', id, versions: ['1.0'], title });
export const app = (id: string, path: string, fields: { title?: string; appStore?: boolean; versions?: string[] } = {}): Item =>
  ({ source: 'app', id, versions: fields.versions ?? ['1.0.0'], title: fields.title ?? path.split('/').at(-1)!.replace(/\.app$/, ''), path, appStore: fields.appStore ?? false });
export const launchd = (id: string, program: string | null, path = `/Users/username/Library/LaunchAgents/${id}.plist`, script: string | null = null): Item =>
  ({ source: 'launchd', id, versions: [], scope: 'user-agent', path, program, script });
/** A helper an app declares inside its bundle (app-helpers change). */
export const helper = (id: string, path: string, scope: 'app-agent' | 'app-daemon' | 'app-login-item' = 'app-daemon', program: string | null = null): Item =>
  ({ source: 'launchd', id, versions: [], scope, path, program, script: null });
export const simple = (source: 'mise' | 'npm' | 'pipx', id: string, versions = ['1.0.0']): Item => ({ source, id, versions });

export function snapshotOf(items: Item[], sources: Partial<Record<SourceName, { status?: Status; ignored?: number }>> = {}): Snapshot {
  const list: SnapshotSource[] = SOURCES.map(source => {
    const status = sources[source]?.status ?? 'ok';
    return { source, status, reason: status === 'ok' ? null : status === 'skipped' ? 'not found' : 'exited with code 1',
      items: status === 'ok' ? items.filter(item => item.source === source).length : 0, ignored: sources[source]?.ignored ?? 0 };
  });
  return { format: 'stackledger-snapshot/v1', takenAt: TAKEN_AT, machine: { name: 'username-macbook-air', user: 'username', macos: '27.2' },
    sources: list, items: [...items].sort(compareItems) };
}

export function comp(name: string, annotations: Record<string, string> = {}, fields: { title?: string; dependsOn?: string[] } = {}): Component {
  return { apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
    metadata: { name, ...(fields.title ? { title: fields.title } : {}), ...(Object.keys(annotations).length ? { annotations } : {}) },
    spec: { type: 'tool', lifecycle: 'active', owner: 'group:northwind', ...(fields.dependsOn ? { dependsOn: fields.dependsOn } : {}) } };
}
