import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'apps/**/tests/**/*.spec.{ts,tsx}',
      'packages/**/tests/**/*.spec.{ts,tsx}',
      'scripts/**/*.spec.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
    },
  },
})
