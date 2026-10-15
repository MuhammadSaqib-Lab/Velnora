import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Unit tests for framework-free frontend logic (src/lib). Deliberately separate
// from vite.config.ts so tests don't load the React/Tailwind plugins or the dev proxy.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
