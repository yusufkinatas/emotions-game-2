import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/balance/**/*.test.ts'],
    testTimeout: 600_000,
  },
});
