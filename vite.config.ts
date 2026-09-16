import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createServiceJwt, serviceJwtSignerConfig } from './server/serviceJwt.ts'

// https://vite.dev/config/
// /api is served by the sibling react-game-ai-server project.
export default defineConfig(async ({ command, mode }) => {
  let developmentToken = ''
  if (command === 'serve') {
    const signer = serviceJwtSignerConfig(loadEnv(mode, process.cwd(), ''))
    const refresh = async () => { developmentToken = await createServiceJwt(signer) }
    await refresh()
    const timer = setInterval(() => void refresh(), 30_000)
    timer.unref()
  }

  const authenticatedProxy = {
    target: 'http://localhost:8787',
    configure(proxy: { on(event: 'proxyReq', listener: (request: { setHeader(name: string, value: string): void }) => void): void }) {
      proxy.on('proxyReq', (request) => request.setHeader('authorization', `Bearer ${developmentToken}`))
    },
  }

  return {
    plugins: [react()],
    optimizeDeps: { include: ['phaser'] },
    build: { chunkSizeWarningLimit: 2000 },
    server: { proxy: { '/api': authenticatedProxy } },
    preview: { proxy: { '/api': authenticatedProxy } },
  }
})
