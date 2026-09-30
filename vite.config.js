import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build: ESM bundle + one stylesheet. React is a peer, never
// bundled, so apps share a single copy of it.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'piui',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
