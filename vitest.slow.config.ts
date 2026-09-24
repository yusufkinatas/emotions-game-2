import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/**/*.test.ts'],
    testTimeout: 300_000,
  },
});
