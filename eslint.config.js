import globals from 'globals'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules/**', 'lib/**', 'dist/**', 'coverage/**', '.pnpm-store/**', '.pnpm-home/**'] },
  {
    files: ['**/*.{ts,tsx,mjs,cjs,js}'],
    languageOptions: {
      globals: { ...globals.node },
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
