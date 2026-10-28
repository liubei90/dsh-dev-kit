import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@devkit\/repo\/readers$/u, replacement: `${repoRoot}packages/devkit-repo/src/readers.ts` },
      { find: /^@devkit\/repo$/u, replacement: `${repoRoot}packages/devkit-repo/src/index.ts` },
      { find: /^@devkit\/shared$/u, replacement: `${repoRoot}packages/shared/src/index.ts` },
    ],
  },
  test: {
    include: [
      'apps/**/tests/**/*.spec.{ts,tsx}',
      'packages/**/tests/**/*.spec.{ts,tsx}',
      'tools/**/tests/**/*.spec.{ts,tsx}',
      'scripts/**/*.spec.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'apps/*/src/**/*.{ts,tsx}',
        'packages/*/src/**/*.{ts,tsx}',
        'tools/*/src/**/*.ts',
      ],
    },
  },
})
