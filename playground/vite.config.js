import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Dev playground: serves the components straight from source so a
// change shows up instantly. Not part of the published package.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: { piui: fileURLToPath(new URL('../src/index.js', import.meta.url)) },
  },
  server: { port: 5199 },
})
