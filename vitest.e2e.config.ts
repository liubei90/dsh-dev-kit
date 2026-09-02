import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/**/tests/**/*.e2e.ts', 'packages/**/tests/**/*.e2e.ts'],
    testTimeout: 30000,
  },
})
