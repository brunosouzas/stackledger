/** Exact decimal amounts (licence-reports design D2): parsing YAML numbers, exact sums and
 * divisions, rounding half away from zero and the JSON round-trip check. Run npm test.
 */
import { expect, test } from 'vitest';
import { add, amountOf, divide, equal, formatAmount, jsonNumber, multiply, roundCents, ZERO } from '../../src/money.js';

test('Costs are read from their shortest decimal text, not their binary value', () => {
  expect(formatAmount(add(add(amountOf(0.1), amountOf(0.2)), ZERO))).toBe('0.30');
  expect(equal(add(amountOf(0.1), amountOf(0.2)), amountOf(0.3))).toBe(true);
  expect(equal(amountOf(1.00499), { numerator: 100499n, denominator: 100000n })).toBe(true);
});

test('Exponent notation is expanded', () => {
  expect(equal(amountOf(1e21), { numerator: 10n ** 21n, denominator: 1n })).toBe(true);
  expect(equal(amountOf(1.5e-7), { numerator: 15n, denominator: 10n ** 8n })).toBe(true);
  expect(formatAmount(amountOf(1e21))).toBe('1000000000000000000000.00');
});

test('Invalid costs are refused', () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => amountOf(value)).toThrow();
});

test('Division keeps the remainder until the amount is shown', () => {
  const monthly = divide(amountOf(100), 12n);
  expect(formatAmount(monthly)).toBe('8.33');
  // Twelve exact twelfths make the yearly amount again, with no rounding drift.
  let sum = ZERO;
  for (let month = 0; month < 12; month++) sum = add(sum, monthly);
  expect(equal(sum, amountOf(100))).toBe(true);
  expect(formatAmount(multiply(amountOf(10), 12n))).toBe('120.00');
});

test('Rounding is half away from zero', () => {
  expect(formatAmount(amountOf(0.125))).toBe('0.13');
  expect(formatAmount(amountOf(0.124999))).toBe('0.12');
  expect(formatAmount(amountOf(2.5e-3))).toBe('0.00');
  expect(formatAmount(amountOf(5e-3))).toBe('0.01');
  expect(roundCents({ numerator: -125n, denominator: 1000n })).toBe(-13n);
  expect(formatAmount({ numerator: -125n, denominator: 1000n })).toBe('-0.13');
});

test('JSON numbers only when they round-trip', () => {
  expect(jsonNumber(amountOf(10))).toBe(10);
  expect(jsonNumber(divide(amountOf(100), 12n))).toBe(8.33);
  expect(jsonNumber(amountOf(1.3))).toBe(1.3);
  expect(jsonNumber(amountOf(1e21))).toBe(1e21);
  // 12345678901234567.89 has more digits than a double holds.
  expect(jsonNumber({ numerator: 1234567890123456789n, denominator: 100n })).toBeUndefined();
});
