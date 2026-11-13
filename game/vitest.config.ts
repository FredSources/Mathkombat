import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Cœur pur couvert par les tests (AGENTS.md §6) — s'étend à combat-engine
      // et ai-controller en J3. Le logger est couvert par les tests L3 (J3+).
      include: ['src/core/config.ts', 'src/core/math-generator.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: '../output/reports/coverage',
    },
  },
});
