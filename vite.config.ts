import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
)
const release = process.env.VITE_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'development'

// https://vite.dev/config/
// /api is served by the sibling react-game-ai-server project.
export default defineConfig({
  define: {
    'import.meta.env.VITE_RELEASE': JSON.stringify(release),
  },
  plugins: [
    react(),
    {
      name: 'glitch-shift:release-artifact',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ release }),
        })
      },
    },
    sentryUploadEnabled && sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      release: { name: release },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry: false,
    }),
  ],
  optimizeDeps: { include: ['phaser'] },
  build: { chunkSizeWarningLimit: 2000, sourcemap: sentryUploadEnabled ? 'hidden' : false },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
