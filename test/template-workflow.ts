/** Read the catalogue repository template's workflow (examples/catalogue-repository) for the
 * template tests in test/unit and test/integration. Run through npm test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const template = fileURLToPath(new URL('../examples/catalogue-repository/', import.meta.url));
export const workflowPath = '.github/workflows/stackledger.yml';

export interface Step { name?: string; id?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string>; 'working-directory'?: string }
export interface Job { needs?: string | string[]; if?: string; permissions?: Record<string, string>; 'runs-on': string; steps: Step[] }
export interface Workflow { on: Record<string, unknown>; permissions?: unknown; concurrency?: { group: string; 'cancel-in-progress': boolean }; env: Record<string, string>; jobs: { site: Job; deploy: Job } }

export function readWorkflow(): Workflow {
  return parse(readFileSync(new URL(workflowPath, `file://${template}`), 'utf8')) as Workflow;
}
