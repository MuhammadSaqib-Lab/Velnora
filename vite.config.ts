import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Mirrors vercel.json's /api rewrite to the deployed backend: the
    // frontend always calls a same-origin relative "/api" path (see
    // src/lib/api.ts), proxied here to the local backend in dev and by
    // Vercel to Render in production. Neither environment ever makes a
    // genuinely cross-origin request for the admin session cookie to
    // survive, which sidesteps SameSite/third-party-cookie browser
    // restrictions entirely instead of fighting them.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
