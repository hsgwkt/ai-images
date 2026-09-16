import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // クラウド上の `npm run dev:tunnel` 向け（手元は通常 `npm run dev`）
    allowedHosts: ['.trycloudflare.com'],
  },
})
