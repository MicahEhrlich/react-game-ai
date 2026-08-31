import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// /api is served by the sibling react-game-ai-server project.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ['phaser'] },
  build: { chunkSizeWarningLimit: 2000 },
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
