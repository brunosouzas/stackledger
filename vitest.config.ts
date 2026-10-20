/** Run catalogue unit and real-filesystem integration checks with npm test. */
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'], passWithNoTests: false, maxWorkers: 4, testTimeout: 30000 } });
