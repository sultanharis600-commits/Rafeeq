import { defineConfig } from 'vitest/config';

// Integration tests that need Postgres (test/**/*.e2e-spec.ts). They share one
// database, so they run one file at a time.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    env: { NODE_ENV: 'test' },
    hookTimeout: 30000,
  },
});
