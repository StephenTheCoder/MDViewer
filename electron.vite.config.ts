import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
export default defineConfig({
  main: {},
  preload: { build: { rollupOptions: { output: { format: 'cjs' } } } },
  renderer: { worker: { format: 'es' }, build: { chunkSizeWarningLimit: 2500, rollupOptions: { input: { index: resolve('src/renderer/index.html'), diagram: resolve('src/renderer/diagram.html') } } } }
})
