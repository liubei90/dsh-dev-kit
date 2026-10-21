import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/**/tests/**/*.e2e.{ts,tsx}', 'packages/**/tests/**/*.e2e.{ts,tsx}'],
    testTimeout: 30000,
    // A checkout without credentials or end-to-end specs yet must not fail the
    // job; individual specs self-skip when their environment is unavailable.
    passWithNoTests: true,
  },
})
