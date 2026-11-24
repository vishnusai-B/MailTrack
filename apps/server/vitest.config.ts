import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The DB integration suite needs a generated Prisma client and a live
    // dedicated test database, so it runs only via `npm run test:integration`
    // (vitest.config.integration.ts), not in the default test run.
    exclude: [...configDefaults.exclude, 'tests/tracking.integration.test.ts'],
  },
});
