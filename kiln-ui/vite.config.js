import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // In local dev, proxy /api calls to the FastAPI backend
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  build: {
    // Output goes into kiln/static — FastAPI serves it from there
    outDir: '../static',
    emptyOutDir: true
  }
})
