/** Control characters in command output: one place for the two rules every command follows.
 * Used by src/errors.ts (stderr), src/cli.ts (validate), src/drift-formats.ts, src/report-formats.ts
 * and src/discovery/snapshot.ts.
 *
 * Why: file names, option names and catalogue or snapshot text come from outside, and a raw C0 or C1
 * character (ESC, U+009B CSI) written to a terminal can move the cursor, clear the screen or set the
 * window title. Ordinary text has none, so both rules leave it byte for byte unchanged.
 *
 * - withoutControls(text): C0 (U+0000–U+001F), DEL and C1 (U+007F–U+009F) removed. For one line of text
 *   output or one message; the caller adds its own line feeds afterwards.
 * - escapeJsonControls(json): U+007F–U+009F written as `\u` escapes in JSON text from JSON.stringify,
 *   which already escapes U+0000–U+001F but leaves DEL and C1 raw. The values parse back unchanged.
 */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const JSON_RAW_CONTROL = /[\u007f-\u009f]/g;

export function withoutControls(text: string): string {
  return text.replace(CONTROL, '');
}

export function escapeJsonControls(json: string): string {
  return json.replace(JSON_RAW_CONTROL, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
