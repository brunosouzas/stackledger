/** Boundary regressions discovered during review. Run npm run build && npm test. */
import { test, expect } from 'vitest';
import { parseSource } from '../../src/source.js';
import { validateSources } from '../../src/validate.js';
import { component } from '../helpers.js';
test('Metadata mappings reject numeric YAML keys before conversion to JavaScript', () => {
 for (const field of ['labels', 'annotations']) {
  const text = component().replace('  name: a', `  name: a\n  ${field}:\n    42: text`);
  const result = validateSources(parseSource('a.yaml', text).sources);
  expect(result.problems).toMatchObject([{ field: `metadata.${field}.42`, line: 6, column: 5, severity: 'error' }]);
 }
});
test('Metadata mapping keys resolve string and numeric aliases without coercion', () => {
 for (const field of ['labels', 'annotations']) {
  const valid = component().replace('metadata:', 'labelKey: &key environment\nmetadata:').replace('  name: a', `  name: a\n  ${field}:\n    *key : synthetic`);
  expect(validateSources(parseSource('a.yaml', valid).sources).problems).toEqual([]);
  const invalid = valid.replace('&key environment', '&key 42');
  expect(validateSources(parseSource('a.yaml', invalid).sources).problems).toMatchObject([{ field: `metadata.${field}.42`, line: 7, column: 5, severity: 'error' }]);
 }
});
test('Kind-field errors stop the secret scan', () => {
 const text = component().replace('  owner: user:alex\n', '').replace('  name: a', '  name: a\n  annotations:\n    deploy/Token: abc');
 const result = validateSources(parseSource('a.yaml', text).sources);
 expect(result.problems).toMatchObject([{ field: 'spec.owner' }]); expect(result.problems).toHaveLength(1);
});
