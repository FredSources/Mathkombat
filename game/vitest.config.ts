import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Cœur pur couvert par les tests (AGENTS.md §6) — le logger est couvert
      // par les tests L3 (J3+).
      include: [
        'src/core/config.ts',
        'src/core/math-generator.ts',
        'src/core/combat-engine.ts',
        'src/core/ai-controller.ts',
      ],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: '../output/reports/coverage',
    },
  },
});
