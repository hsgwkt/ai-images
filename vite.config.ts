import { sveltekit } from '@sveltejs/kit/vite'
import { Features } from 'lightningcss'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  css: {
    lightningcss: {
      exclude: Features.LightDark,
    },
  },
  server: {
    // クラウド上の `npm run dev:tunnel` 向け（手元は通常 `npm run dev`）
    allowedHosts: ['.trycloudflare.com'],
  },
})
