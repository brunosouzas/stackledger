/** Read-only MCP server over stdio: stackledger mcp <folder> [--view full|staff].
 * Every call re-reads the folder and answers only from applyView, so staff never sees hidden fields.
 * stdout carries only protocol messages; stderr gets a start line and one line per tool error.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { validateFolder, type Summary } from './validate.js';
import type { Problem } from './source.js';
import { applyView, resolveHidden, type ViewName } from './views.js';
import { buildGraph, findItems, gaps, impact, isDate, itemDetail, localDate, lookup, renewals, addDays, type Graph, type ItemKind } from './graph.js';
const version = '0.1.0';
const kinds: readonly ItemKind[] = ['component', 'licence', 'resource', 'line'];
/** Messages loadFolder throws on purpose; anything else is reported without its text. */
const folderErrors = new Set(['Catalogue folder was not found', 'Catalogue path is not a folder', 'Catalogue folder cannot be read']);
type Args = Record<string, unknown>;
interface Context { graph: Graph; problems: Problem[]; summary: Summary }
class ToolError extends Error {}
const fail = (reason: string): never => { throw new ToolError(reason); };

function optional(args: Args, key: string, check: (value: unknown) => boolean, rule: string): unknown {
  const value = args[key];
  if (value !== undefined && !check(value)) fail(`${key} must be ${rule}`);
  return value;
}
const isString = (value: unknown) => typeof value === 'string';
const inRange = (min: number, max: number) => (value: unknown) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
function reference(args: Args, graph: Graph) {
  const value = args.ref;
  if (value === undefined) fail('ref is required');
  if (typeof value !== 'string') fail('ref must be a string');
  const item = lookup(graph, value as string);
  return 'error' in item ? fail(item.error) : item;
}
const ref = z.unknown().optional().describe('Item reference: component:<name>, resource:<name> or line:<name>; any case, optional default/ namespace');
const strings = z.array(z.string());
const summarySchema = z.object({ ref: z.string(), kind: z.enum(kinds), title: z.string().optional(), type: z.string().optional(),
  lifecycle: z.string().optional(), owner: z.string().optional(), zone: z.string().optional() });
const renewalSchema = z.object({ ref: z.string(), vendor: z.string(), status: z.string(), renewsOn: z.string(), cycle: z.string(),
  cost: z.union([z.number(), z.literal('unknown')]), currency: z.string() });
interface Tool { name: string; title: string; description: string; views: ViewName[]; input: z.ZodRawShape; output: z.ZodRawShape; run: (args: Args, context: Context) => Record<string, unknown> }
const tools: Tool[] = [
  { name: 'find_items', title: 'Find items', views: ['full', 'staff'],
    description: 'Find components, licences, other resources and lines. query matches part of the name, title, description, a tag or a visible licence field, ignoring case. Sorted by reference; at most limit items.',
    input: { query: z.unknown().optional().describe('Text to match, ignoring case'), kind: z.unknown().optional().describe('component, licence, resource or line'),
      zone: z.unknown().optional().describe('Zone name from the stackledger/zone label, ignoring case'), limit: z.unknown().optional().describe('Maximum items, 1 to 200; default 50') },
    output: { items: z.array(summarySchema), total: z.number().int(), truncated: z.boolean() },
    run(args, { graph }) {
      const query = optional(args, 'query', isString, 'a string') as string | undefined;
      const kind = optional(args, 'kind', value => kinds.includes(value as ItemKind), `one of ${kinds.join(', ')}`) as ItemKind | undefined;
      const zone = optional(args, 'zone', isString, 'a string') as string | undefined;
      const limit = (optional(args, 'limit', inRange(1, 200), 'an integer from 1 to 200') ?? 50) as number;
      return findItems(graph, { limit, ...(query === undefined ? {} : { query }), ...(kind ? { kind } : {}), ...(zone === undefined ? {} : { zone }) });
    } },
  { name: 'get_item', title: 'Get an item', views: ['full', 'staff'],
    description: 'One item with its relations: the document as the view shows it, what depends on it, the lines that stop at it and, for a component, what it depends on and the references that match nothing.',
    input: { ref },
    output: { ref: z.string(), kind: z.enum(kinds), metadata: z.record(z.string(), z.unknown()).optional(), spec: z.record(z.string(), z.unknown()).optional(),
      type: z.string().optional(), zone: z.string().nullable().optional(), dependsOn: strings.optional(), unresolved: strings.optional(),
      dependants: strings.optional(), lines: strings.optional(), stops: strings.optional() },
    run(args, { graph }) { return itemDetail(graph, reference(args, graph)); } },
  { name: 'impact', title: 'What breaks if an item is removed', views: ['full', 'staff'],
    description: 'Every item that depends on a component or resource, directly or through others, with its smallest depth, and every line that stops at the item or a dependant. At most 500 dependants.',
    input: { ref },
    output: { ref: z.string(), dependants: z.array(z.object({ ref: z.string(), depth: z.number().int() })), lines: strings, truncated: z.boolean() },
    run(args, { graph }) {
      const item = reference(args, graph);
      if (item.kind === 'line') fail(`impact accepts a component or resource, not ${args.ref as string}`);
      return { ref: item.ref, ...impact(graph, item) };
    } },
  { name: 'gaps', title: 'Gaps in the catalogue', views: ['full', 'staff'],
    description: 'Components with no relation, components on no line, and licences no component uses.',
    input: {}, output: { isolated: strings, offMap: strings, unusedLicences: strings },
    run(_args, { graph }) { return gaps(graph); } },
  { name: 'renewals', title: 'Licence renewals', views: ['full'],
    description: 'Active and to-confirm licences renewing from `from` to `from` plus `days`, both included; those already overdue; and those whose renewal date is unknown.',
    input: { days: z.unknown().optional().describe('Window length in days, 0 to 366; default 30'), from: z.unknown().optional().describe('Start date YYYY-MM-DD; default today on this machine') },
    output: { from: z.string(), to: z.string(), licences: z.array(renewalSchema), overdue: z.array(renewalSchema), unknown: strings },
    run(args, { graph }) {
      const days = (optional(args, 'days', inRange(0, 366), 'an integer from 0 to 366') ?? 30) as number;
      const from = (optional(args, 'from', value => typeof value === 'string' && isDate(value), 'a real date written YYYY-MM-DD') ?? localDate()) as string;
      if (!isDate(addDays(from, days))) fail('from plus days must be no later than 9999-12-31');
      return renewals(graph, from, days);
    } },
  { name: 'validate', title: 'Validate the catalogue', views: ['full'],
    description: 'The problems and summary that stackledger validate --json prints for the folder. Use it after editing catalogue YAML.',
    input: {},
    output: { problems: z.array(z.object({ path: z.string(), line: z.number().int(), column: z.number().int(), severity: z.enum(['error', 'warning']), field: z.string().nullable(), message: z.string() })),
      summary: z.object({ files: z.number().int(), documents: z.number().int(), ignored: z.number().int(), errors: z.number().int(), warnings: z.number().int() }) },
    run(_args, { problems, summary }) { return { problems, summary }; } },
];
/** Logs must stay one line each, whatever text a caller passed as an argument. */
function oneLine(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
export function toolsFor(view: ViewName): string[] { return tools.filter(tool => tool.views.includes(view)).map(tool => tool.name); }
export async function serve(folder: string, view: ViewName): Promise<void> {
  const server = new McpServer({ name: 'stackledger', version }, { instructions: `Read-only stackledger catalogue in the ${view} view. References are component:<name>, resource:<name> or line:<name>.` });
  const offered = tools.filter(tool => tool.views.includes(view));
  const catalogue = view === 'full' ? z.object({ view: z.literal('full'), errors: z.number().int(), warnings: z.number().int() }) : z.object({ view: z.literal('staff') });
  for (const tool of offered) {
    server.registerTool(tool.name, { title: tool.title, description: tool.description, inputSchema: tool.input,
      outputSchema: { catalogue, ...tool.output }, annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true } },
    async (args: Args) => {
      try {
        // Each call reads the folder again: an agent sees its own edits and the server keeps no state.
        const loaded = await validateFolder(folder).catch((error: unknown) => fail(error instanceof Error && folderErrors.has(error.message) ? error.message : 'Catalogue cannot be read'));
        const graph = buildGraph(applyView(loaded.served, view, resolveHidden(loaded)));
        const result = { catalogue: view === 'full' ? { view, errors: loaded.summary.errors, warnings: loaded.summary.warnings } : { view },
          ...tool.run(args ?? {}, { graph, problems: loaded.problems, summary: loaded.summary }) };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
      } catch (error) {
        const reason = error instanceof ToolError ? error.message : 'Internal error';
        process.stderr.write(`stackledger mcp: ${tool.name}: ${oneLine(reason)}\n`);
        return { isError: true, content: [{ type: 'text' as const, text: reason }] };
      }
    });
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // When the client closes stdin, nothing keeps the event loop alive: pending calls finish and the process exits with 0.
  process.stderr.write(`stackledger mcp: serving ${oneLine(folder)} in the ${view} view with ${offered.length} tools\n`);
}
