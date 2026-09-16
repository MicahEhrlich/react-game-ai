import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    restoreMocks: true,
  },
})
