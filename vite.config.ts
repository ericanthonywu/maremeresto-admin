/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The dev proxy target is configurable so the portal can be run against a
// staging backend without editing this file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // Required for the live order WebSocket at /api/v1/ws.
          ws: true
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    }
  }
})
