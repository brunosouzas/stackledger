/** MCP sessions against the built CLI through the official SDK client. Build first with npm run build.
 * connect() uses StdioClientTransport; raw() records every stdout byte and the exit code for leak checks.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { stringify } from 'yaml';
import { cli, root } from './helpers.js';
const env = () => ({ ...process.env, NODE_OPTIONS: '' }) as Record<string, string>;
export const yaml = (...documents: unknown[]) => documents.map(document => stringify(document)).join('---\n');
export interface Call { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, any> }
export interface Session { client: Client; call(name: string, args?: Record<string, unknown>): Promise<Call>; stderr(): string; close(): Promise<void> }
async function open(transport: Transport, stderr: () => string): Promise<Session> {
  const client = new Client({ name: 'stackledger-test', version: '0.0.0' });
  await client.connect(transport);
  return { client, stderr, close: () => client.close(),
    call: async (name, args = {}) => await client.callTool({ name, arguments: args }) as unknown as Call };
}
export function serverArgs(folder: string, view?: string, flags: string[] = []): string[] {
  return [...flags, cli, 'mcp', folder, ...(view ? ['--view', view] : [])];
}
export async function connect(folder: string, view?: string, flags: string[] = [], cwd = root): Promise<Session> {
  const transport = new StdioClientTransport({ command: process.execPath, args: serverArgs(folder, view, flags), cwd, env: env(), stderr: 'pipe' });
  let stderr = '';
  transport.stderr!.on('data', chunk => { stderr += String(chunk); });
  return open(transport, () => stderr);
}
/** Run fn with a session and always stop the server. */
export async function withSession<T>(folder: string, view: string | undefined, fn: (session: Session) => Promise<T>): Promise<T> {
  const session = await connect(folder, view);
  try { return await fn(session); } finally { await session.close(); }
}
/** A stdio transport that keeps the raw bytes the server wrote and its exit code. */
export class RawTransport implements Transport {
  onclose?: () => void; onerror?: (error: Error) => void; onmessage?: (message: JSONRPCMessage) => void;
  readonly stdout: Buffer[] = []; stderr = ''; exit!: Promise<number | null>;
  private child?: ChildProcessWithoutNullStreams; private readonly buffer = new ReadBuffer();
  constructor(private readonly args: string[]) {}
  async start(): Promise<void> {
    const child = this.child = spawn(process.execPath, this.args, { cwd: root, env: env(), stdio: ['pipe', 'pipe', 'pipe'] });
    this.exit = new Promise(resolve => child.on('close', code => { resolve(code); this.onclose?.(); }));
    child.stdout.on('data', (chunk: Buffer) => {
      this.stdout.push(chunk); this.buffer.append(chunk);
      for (let message = this.buffer.readMessage(); message; message = this.buffer.readMessage()) this.onmessage?.(message);
    });
    child.stderr.on('data', chunk => { this.stderr += String(chunk); });
  }
  async send(message: JSONRPCMessage): Promise<void> { this.child!.stdin.write(serializeMessage(message)); }
  async close(): Promise<void> { this.child?.stdin.end(); await this.exit; }
  raw(): string { return Buffer.concat(this.stdout).toString('utf8'); }
}
export async function raw(folder: string, view?: string, flags: string[] = []): Promise<Session & { transport: RawTransport }> {
  const transport = new RawTransport(serverArgs(folder, view, flags));
  return { ...await open(transport, () => transport.stderr), transport };
}
/** stderr arrives on its own pipe; wait until it holds the expected text. */
export async function waitFor(read: () => string, text: string, ms = 5000): Promise<string> {
  for (const end = Date.now() + ms; Date.now() < end && !read().includes(text);) await new Promise(resolve => setTimeout(resolve, 20));
  return read();
}
