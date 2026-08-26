import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { directorApi } from './server/directorEndpoint.ts'

// https://vite.dev/config/
// The function form is required so `mode` can be handed to loadEnv, which is
// how the director endpoint reads ANTHROPIC_API_KEY out of .env.local.
export default defineConfig(({ mode }) => ({
  plugins: [react(), directorApi(mode)],
  optimizeDeps: { include: ['phaser'] },
  build: { chunkSizeWarningLimit: 2000 },
}))
