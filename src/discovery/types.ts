/** The items and source results discovery produces (design D3). Shared by the source modules,
 * src/discovery/snapshot.ts (whose zod schema checks the same shape) and src/discovery/index.ts.
 * Each source has exactly the fields shown for it; `versions` is empty only for launchd and for an
 * app without CFBundleShortVersionString.
 */
import type { SourceName } from './annotations.js';
import type { Reason } from './run.js';

export type { SourceName } from './annotations.js';
export type Status = 'ok' | 'skipped' | 'failed';
export type LaunchdScope = 'user-agent' | 'agent' | 'daemon' | 'app-agent' | 'app-daemon' | 'app-login-item';
/** Scopes of the helpers an app declares inside its bundle (mac-discovery spec, App helpers). */
export const APP_HELPER_SCOPES: readonly LaunchdScope[] = ['app-agent', 'app-daemon', 'app-login-item'];

export interface BrewItem { source: 'brew'; id: string; versions: string[]; onRequest: boolean; dependsOn: string[] }
export interface CaskItem { source: 'cask'; id: string; versions: string[]; apps: string[] }
export interface MasItem { source: 'mas'; id: string; versions: string[]; title: string }
export interface AppItem { source: 'app'; id: string; versions: string[]; title: string; path: string; appStore: boolean }
export interface LaunchdItem { source: 'launchd'; id: string; versions: string[]; scope: LaunchdScope; path: string; program: string | null; script: string | null }
export interface MiseItem { source: 'mise'; id: string; versions: string[] }
export interface NpmItem { source: 'npm'; id: string; versions: string[] }
export interface PipxItem { source: 'pipx'; id: string; versions: string[] }
export type Item = BrewItem | CaskItem | MasItem | AppItem | LaunchdItem | MiseItem | NpmItem | PipxItem;

/** What one source read: its status, a fixed reason (null exactly when ok), its items and how many
 * entries it found but could not record. */
export interface SourceResult { source: SourceName; status: Status; reason: Reason | null; items: Item[]; ignored: number }

export function ok(source: SourceName, items: Item[], ignored: number): SourceResult {
  return { source, status: 'ok', reason: null, items, ignored };
}
export function skipped(source: SourceName, reason: Reason = 'not found'): SourceResult {
  return { source, status: 'skipped', reason, items: [], ignored: 0 };
}
export function failed(source: SourceName, reason: Reason): SourceResult {
  return { source, status: 'failed', reason, items: [], ignored: 0 };
}
