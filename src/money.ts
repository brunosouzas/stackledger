/** Exact decimal amounts for the licence report (licence-reports design D2).
 *
 * Why: YAML gives each cost as a JavaScript number, a binary double, so 0.1 + 0.2 is not 0.3.
 * amountOf(cost) reads the number's shortest round-trip decimal text (String(cost), with exponent
 * notation expanded) into an exact fraction of two bigints. Sums, ×12 and ÷12 stay exact; only an
 * amount that is shown is rounded, half away from zero, to two decimals (formatAmount).
 *
 * jsonNumber(amount) gives the rounded amount as a JSON number only when that number reads back as
 * the same decimal value; otherwise it returns undefined and the caller fails (an absurd cost, far
 * beyond any real price, such as 12345678901234567.89).
 *
 * Call: formatAmount(divide(amountOf(120), 12n)) === '10.00'. Throws for a negative or non-finite
 * cost; the catalogue schema already refuses both, so that would be a bug.
 */

/** numerator / denominator, with denominator > 0 and the fraction in lowest terms. */
export interface Amount {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export const ZERO: Amount = { numerator: 0n, denominator: 1n };

const CENTS = 100n;
const DECIMAL_TEXT = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/;

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function fraction(numerator: bigint, denominator: bigint): Amount {
  if (denominator <= 0n) throw new Error('An amount needs a positive denominator');
  const divisor = gcd(numerator, denominator) || 1n;
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

/** The exact decimal value of a decimal text such as '1.00499', '1e+21' or '1.5e-7'. */
function parseDecimal(text: string): Amount | undefined {
  const match = DECIMAL_TEXT.exec(text);
  if (!match) return undefined;
  const [, whole, decimals = '', exponent = '0'] = match;
  const coefficient = BigInt(whole! + decimals);
  const scale = decimals.length - Number(exponent);
  return scale >= 0 ? fraction(coefficient, 10n ** BigInt(scale)) : fraction(coefficient * 10n ** BigInt(-scale), 1n);
}

/** A catalogue cost as an exact amount. */
export function amountOf(cost: number): Amount {
  if (!Number.isFinite(cost) || cost < 0) throw new Error(`Not a cost: ${cost}`);
  const amount = parseDecimal(String(cost));
  if (!amount) throw new Error(`Not a cost: ${cost}`);
  return amount;
}

export function add(left: Amount, right: Amount): Amount {
  return fraction(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
}

export function multiply(amount: Amount, factor: bigint): Amount {
  return fraction(amount.numerator * factor, amount.denominator);
}

export function divide(amount: Amount, divisor: bigint): Amount {
  if (divisor <= 0n) throw new Error('Amounts are divided by a positive whole number only');
  return fraction(amount.numerator, amount.denominator * divisor);
}

export function equal(left: Amount, right: Amount): boolean {
  return left.numerator * right.denominator === right.numerator * left.denominator;
}

/** The amount in whole cents, rounded half away from zero. */
export function roundCents(amount: Amount): bigint {
  const negative = amount.numerator < 0n;
  const size = negative ? -amount.numerator : amount.numerator;
  // floor(size × 100 / denominator + 1/2), in integers: (2 × size × 100 + denominator) / (2 × denominator).
  const cents = (2n * size * CENTS + amount.denominator) / (2n * amount.denominator);
  return negative ? -cents : cents;
}

/** The shown text of an amount: rounded to two decimals, no grouping ('1234.50'). */
export function formatAmount(amount: Amount): string {
  const cents = roundCents(amount);
  const sign = cents < 0n ? '-' : '';
  const size = cents < 0n ? -cents : cents;
  const whole = size / CENTS;
  const rest = String(size % CENTS).padStart(2, '0');
  return `${sign}${whole}.${rest}`;
}

/** The rounded amount as a JSON number, or undefined when no double holds it exactly. */
export function jsonNumber(amount: Amount): number | undefined {
  const text = formatAmount(amount);
  const value = Number(text);
  const back = parseDecimal(String(Math.abs(value)));
  if (!Number.isFinite(value) || !back) return undefined;
  const rounded = fraction(roundCents(amount), CENTS);
  return equal(value < 0 ? { numerator: -back.numerator, denominator: back.denominator } : back, rounded) ? value : undefined;
}
