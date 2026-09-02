import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/**/tests/**/*.spec.ts', 'packages/**/tests/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
    },
  },
})
