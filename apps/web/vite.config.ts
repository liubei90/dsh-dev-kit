// Vite configuration for the web app. The dev server proxies /auth to the
// API origin so the page and API agree on one origin during development
// (VITE_API_PROXY_URL env, default localhost:3000). @devkit/shared resolves
// to its source so edits hot-reload without a rebuild.

import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@devkit/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    proxy: {
      '/auth': {
        target: process.env.VITE_API_PROXY_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
