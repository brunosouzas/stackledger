/** Guard against accidental credentials and personal addresses. Used after schema checks, and by
 * the discovery snapshot (src/discovery/snapshot.ts) through secretRules, so both apply one rule.
 * Messages are constants: neither a detected value nor parser excerpts reach output.
 */
import { isScalar } from 'yaml';
import { problem, sourceNode, resolveNode, type Source, type Problem, type FieldPath } from './source.js';
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = digits.length - 1, double = false; i >= 0; i--, double = !double) {
    let digit = Number(digits[i]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}
export const PRIVATE_KEY_RULE = 'Private key material is not allowed';
export const CARD_NUMBER_RULE = 'Payment-card number is not allowed';
/** The secret rules a text breaks: private-key material and a payment-card number (13–19 digits,
 * optionally separated by single spaces or hyphens, passing the Luhn check). Empty when none. */
export function secretRules(text: string): string[] {
  const rules: string[] = [];
  if (/-----BEGIN[^\r\n]*PRIVATE KEY-----/.test(text)) rules.push(PRIVATE_KEY_RULE);
  // Match the entire run before checking length, avoiding a valid substring of a longer number.
  const runs = text.match(/\d(?:[ -]?\d)*/g) ?? [];
  if (runs.some(run => { const digits = run.replace(/[ -]/g, ''); return digits.length >= 13 && digits.length <= 19 && luhn(digits); })) rules.push(CARD_NUMBER_RULE);
  return rules;
}
export function scanSecrets(source: Source): Problem[] {
  const problems: Problem[] = [];
  const ancestors = new Set<object>();
  function visit(value: unknown, path: FieldPath): void {
    if (value !== null && typeof value === 'object') {
      // YAML aliases may be recursive. Traverse aliases at each path, but never a cycle.
      if (ancestors.has(value)) return;
      ancestors.add(value);
      for (const [key, child] of Object.entries(value)) {
        const childPath = [...path, Array.isArray(value) ? Number(key) : key];
        if (!Array.isArray(value) && /^(password|secret|token|apikey|privatekey)$/.test(key.split('/').at(-1)!.replace(/[-_]/g, '').toLowerCase())) {
          problems.push(problem(source, childPath, 'Secret key is not allowed', 'error', true));
        }
        visit(child, childPath);
      }
      ancestors.delete(value); return;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') return;
    const node = resolveNode(source, sourceNode(source, path));
    // IEEE-754 conversion loses digits of long unquoted integers; inspect the original scalar.
    const text = typeof value === 'number' && isScalar(node) && node.source !== undefined ? node.source : String(value);
    for (const rule of secretRules(text)) problems.push(problem(source, path, rule));
    // The domain must end in a label of letters, so Homebrew names such as python@3.12 are not addresses.
    if (/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9-])/.test(text)) {
      problems.push(problem(source, path, 'E-mail address found; check whether it should be public', 'warning'));
    }
  }
  visit(source.value, []); return problems;
}
