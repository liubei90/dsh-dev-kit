import globals from 'globals'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/lib/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.pnpm-store/**',
      '**/.pnpm-home/**',
      '**/migrations/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,mjs,cjs,js}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Web sources run in the browser; give them DOM globals (window, document).
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
