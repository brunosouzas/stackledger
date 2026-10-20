/** Timing checks (test/perf): one worker, nothing else running, so elapsed time is meaningful.
 * Run with npm run test:perf after npm run build. */
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/perf/**/*.test.ts'], maxWorkers: 1, fileParallelism: false, testTimeout: 120000 } });
