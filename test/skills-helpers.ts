/** Fictitious skill sets for the skills tests: the Northwind team's skills, playbooks and agents,
 * built in a temporary folder (test/helpers.ts removes it after each test). Never real skills.
 *
 * skillSet({ path: text | link(target) }) writes each file, then makes each symbolic link, with the
 * target taken relative to the set's root (a target that does not exist gives a broken link).
 */
import { mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { folder } from './helpers.js';

export interface Link { link: string }
export const link = (target: string): Link => ({ link: target });

export function skillSet(entries: Record<string, string | Link> = {}): string {
  const files: Record<string, string> = {};
  const links: [string, string][] = [];
  for (const [path, entry] of Object.entries(entries)) {
    if (typeof entry === 'string') files[path] = entry; else links.push([path, entry.link]);
  }
  const root = folder(files);
  for (const [path, target] of links) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    symlinkSync(join(root, target), join(root, path));
  }
  return root;
}

export interface SkillOptions {
  description?: string;
  /** Written under `metadata:` in this order, each as `key: value`. */
  metadata?: Record<string, string>;
  /** Raw frontmatter lines added after the metadata. */
  extra?: string;
  body?: string;
}
/** A SKILL.md: line 2 `name`, line 3 `description`, then `metadata:` on line 4 and its keys from line 5. */
export function skill(name: string, options: SkillOptions = {}): string {
  const description = options.description ?? `Helps the Northwind team with ${name}.`;
  const metadata = options.metadata ? `metadata:\n${Object.entries(options.metadata).map(([key, value]) => `  ${key}: ${value}\n`).join('')}` : '';
  return `---\nname: ${name}\ndescription: ${description}\n${metadata}${options.extra ?? ''}---\n\n${options.body ?? `# ${name}\n\nNorthwind notes.\n`}`;
}
/** A playbook naming skills and agents (space-separated, as written). */
export function playbook(name: string, skills?: string, agents?: string): string {
  return skill(name, { metadata: { 'stackledger-kind': 'playbook', ...(skills === undefined ? {} : { 'stackledger-skills': skills }), ...(agents === undefined ? {} : { 'stackledger-agents': agents }) } });
}
/** A Claude Code subagent file. */
export function agent(name: string, extra = ''): string {
  return `---\nname: ${name}\ndescription: Northwind ${name} agent.\ntools: Read, Grep\nmodel: sonnet\n${extra}---\n\nYou are the Northwind ${name}.\n`;
}
/** A rules.md with one group and the given rule lines. */
export function rules(...lines: string[]): string {
  return `# Rules\n\n## Docs (DOC)\n\n${lines.join('\n')}\n`;
}
