import { defineConfig } from 'vitest/config';

// Opt-in PostgreSQL integration suite. Run with `npm run test:integration`;
// requires TEST_DATABASE_URL pointing at a dedicated test database (the
// suite itself enforces this).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/tracking.integration.test.ts'],
  },
});
