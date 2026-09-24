import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// `npm run dev` proxies the API to a running hub: VITE_HUB_URL=https://… npm run dev
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/api': { target: process.env.VITE_HUB_URL ?? 'http://127.0.0.1:8787', changeOrigin: true },
      '/health': { target: process.env.VITE_HUB_URL ?? 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
