import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

// Plugin to serve static HTML files from public/ before SPA fallback kicks in
function servePublicHtml() {
  return {
    name: 'serve-public-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // For paths like /docs/ check if public/docs/index.html exists
        if (req.url.endsWith('/')) {
          const filePath = resolve('public', req.url.slice(1), 'index.html')
          if (existsSync(filePath)) {
            res.setHeader('Content-Type', 'text/html')
            res.end(readFileSync(filePath, 'utf-8'))
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [servePublicHtml(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
