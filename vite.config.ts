import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where the FastAPI backend lives — the Kali VM's host-only adapter. Used by the dev server
// proxy, which is only exercised when .env.local does not set VITE_API_BASE.
// Override with BACKEND_URL=http://host:port npm run dev
const BACKEND = process.env.BACKEND_URL ?? 'http://192.168.56.101:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
})
