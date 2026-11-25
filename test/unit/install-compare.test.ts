// The comparison of two package installs (SW-170): test/integration/install-compare.ts.
import { describe, expect, test } from 'vitest';
import { withoutLockedOptional } from '../integration/install-compare.js';

const locked = new Set(['@rolldown/binding-win32-arm64-msvc@1.2.14', '@rolldown/binding-win32-x64-msvc@1.2.14']);
const first = ['astro@7.3.2', 'astro>rolldown@1.2.14', 'astro>rolldown>@rolldown/binding-win32-arm64-msvc@1.2.14', 'zod@4.1.0'];

describe('two installs compared', () => {
  test('Another platform build in one install only still agrees; a production version that differs does not', () => {
    const second = ['astro@7.3.2', 'astro>rolldown@1.2.14', 'astro>rolldown>@rolldown/binding-win32-x64-msvc@1.2.14', 'zod@4.1.0'];
    expect(withoutLockedOptional(second, locked)).toEqual(withoutLockedOptional(first, locked));
    const other = ['astro@7.3.2', 'astro>rolldown@1.2.13', 'zod@4.1.0'];
    expect(withoutLockedOptional(other, locked)).not.toEqual(withoutLockedOptional(first, locked));
  });
});
