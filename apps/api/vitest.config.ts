import { defineConfig } from 'vitest/config';

// Unit tests live next to the code (src/**/*.spec.ts).
export default defineConfig({
  test: { globals: true, root: './', include: ['src/**/*.spec.ts'] },
});
