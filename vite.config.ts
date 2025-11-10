import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This is needed to proxy Vercel serverless functions
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
